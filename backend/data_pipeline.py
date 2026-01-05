# data_pipeline.py

import tensorflow as tf
import os
import glob
from sklearn.model_selection import train_test_split
from tensorflow import keras
import numpy as np

# --- GLOBAL CONSTANTS (CRITICAL FIX FOR CTC CONSTRAINT) ---
# INPUT_WIDTH increased to 390 to accommodate the longest labels (up to ~326 characters)
INPUT_WIDTH = 390
INPUT_HEIGHT = 32

# --- GLOBAL VARIABLE FOR CHARACTER MAPPING ---
# This is needed because tf.py_function requires global access to the dictionary
char_to_int = {} 


def create_char_to_int_mapping(ground_truth_dir):
    """
    Creates a character-to-integer mapping from all ground truth files.
    (Updated to handle nested directories)
    """
    all_chars = set()
   
    # Iterate through all files in the nested ground truth structure
    for root, _, files in os.walk(ground_truth_dir):
        for filename in files:
            if filename.endswith(".txt"):
                with open(os.path.join(root, filename), 'r', encoding='utf-8') as f:
                    text = f.read()
                    all_chars.update(text)
   
    sorted_chars = sorted(list(all_chars))
    global char_to_int
    char_to_int = {char: i for i, char in enumerate(sorted_chars)}
    int_to_char = {i: char for i, char in enumerate(sorted_chars)}
   
    # Add a blank character for CTC loss (always the last index)
    blank_index = len(char_to_int)
    char_to_int['<blank>'] = blank_index
    int_to_char[blank_index] = '<blank>'
   
    return char_to_int, int_to_char, sorted_chars


def get_image_paths_and_labels(images_base_dir, ground_truth_dir):
    """
    Gets a list of all image file paths and their corresponding ground truth labels.
    (Includes check for empty labels to prevent CTC crash)
    """
    image_paths = []
    labels = []
   
    for student_dir in glob.glob(os.path.join(images_base_dir, "*")):
        if os.path.isdir(student_dir):
            for img_path in glob.glob(os.path.join(student_dir, "*.png")):
                file_name = os.path.basename(img_path).replace(".png", ".txt")
                page_name = os.path.basename(student_dir)
                gt_path = os.path.join(ground_truth_dir, page_name, file_name)
               
                if os.path.exists(gt_path):
                    with open(gt_path, 'r', encoding='utf-8') as f:
                        label = f.read().strip()
                        
                        # --- CRITICAL FIX: Skip if the label is empty ---
                        if label: 
                            image_paths.append(img_path)
                            labels.append(label)
                       
    return image_paths, labels


def _py_load_and_preprocess_helper(image_path, label_text, input_width, input_height):
    """Helper function to load data using Python/Numpy (called by tf.py_function)."""
    # Decode string tensors to Python strings
    image_path = image_path.numpy().decode('utf-8')
    label_text = label_text.numpy().decode('utf-8')
    
    global char_to_int
    
    # Image processing
    image = tf.io.read_file(image_path)
    image = tf.image.decode_png(image, channels=1)
    image = tf.image.convert_image_dtype(image, tf.float32)
    # Resize takes (Height, Width)
    image = tf.image.resize(image, (input_height, input_width)) 
    # Transpose to (Width, Height, Channels) for CRNN
    image = tf.transpose(image, perm=[1, 0, 2]) 
    
    # Label encoding
    # Use .get() with the blank token as default to prevent KeyError
    label_int_list = [char_to_int.get(char, char_to_int['<blank>']) for char in label_text]
    label_encoded = tf.cast(label_int_list, tf.int32)
    
    return image, label_encoded


def create_tf_dataset(image_paths, labels, batch_size):
    """Creates a TensorFlow dataset pipeline using global constants."""

    # Create a dataset from image paths and labels
    dataset = tf.data.Dataset.from_tensor_slices((image_paths, labels))
   
    # Define a wrapper function for map operation
    def load_and_preprocess_wrapper(image_path, label_text):
        # --- CRITICAL FIX: Use tf.py_function to wrap the helper ---
        image, label = tf.py_function(
            _py_load_and_preprocess_helper, 
            # Pass only tensors, but helper uses global constants/map
            [image_path, label_text, INPUT_WIDTH, INPUT_HEIGHT], 
            [tf.float32, tf.int32]
        )
        
        # Must manually set the shape after tf.py_function
        image.set_shape([INPUT_WIDTH, INPUT_HEIGHT, 1]) 
        label.set_shape([None])
        
        return image, label


    # Apply the wrapper function
    dataset = dataset.map(load_and_preprocess_wrapper, num_parallel_calls=tf.data.AUTOTUNE)
    dataset = dataset.shuffle(buffer_size=1000)
    
    # --- PADDING FIX ---
    
    # Final shape must include the channel dimension
    IMAGE_SHAPE_FINAL = (INPUT_WIDTH, INPUT_HEIGHT, 1)

    # Padding value must be the blank index (89 in your case)
    BLANK_PADDING_VALUE = tf.constant(char_to_int['<blank>'], dtype=tf.int32) 

    dataset = dataset.padded_batch(
        batch_size, 
        padded_shapes=(IMAGE_SHAPE_FINAL, [None]), 
        padding_values=(tf.constant(0.0, dtype=tf.float32), BLANK_PADDING_VALUE)
    )
    dataset = dataset.prefetch(buffer_size=tf.data.AUTOTUNE)
    
    return dataset


# Step 6: Define a custom CTC loss function
def ctc_loss_func(y_true, y_pred):
    """Custom CTC loss function for Keras, handling required tensor shapes/types."""
    
    # 1. Input Length (T)
    y_true_int = tf.cast(y_true, dtype=tf.int32)
    time_steps = tf.shape(y_pred)[1]
    # Create a vector of integer time steps (T) for the entire batch
    input_length = tf.fill(dims=[tf.shape(y_pred)[0], 1], value=time_steps)
    input_length = tf.cast(input_length, dtype=tf.int32)
    
    # 2. Label Length (U)
    # Find the padding/blank index (last output channel)
    blank_index = tf.cast(tf.shape(y_pred)[-1] - 1, dtype=tf.int32)
    
    # Calculate the true length by counting non-blank elements
    label_length = tf.math.count_nonzero(tf.not_equal(y_true_int, blank_index), axis=-1)
    label_length = tf.cast(label_length, dtype=tf.int32)
    label_length = tf.expand_dims(label_length, 1) # Must be shape (batch_size, 1)

    # 3. Calculate CTC Loss
    return tf.keras.backend.ctc_batch_cost(
        y_true_int, 
        y_pred, 
        input_length, 
        label_length
    )


# Main execution block
if __name__ == "__main__":
    
    # --- GPU Configuration (Optional but Recommended) ---
    gpus = tf.config.experimental.list_physical_devices('GPU')
    if gpus:
        try:
            tf.config.experimental.set_visible_devices(gpus[0], 'GPU')
            tf.config.experimental.set_memory_growth(gpus[0], True)
            print("✅ GPU detected and configured. Training should now be accelerated.")
        except RuntimeError as e:
            print(f"❌ GPU configuration failed: {e}")
    else:
        print("⚠️ No GPU detected by TensorFlow. Continuing on CPU.")

    # Define your directories
    images_base_dir = "segmented_lines"
    ground_truth_dir = "ground_truth_data"
   
    # Step 1: Create a character mapping
    char_to_int, int_to_char, _ = create_char_to_int_mapping(ground_truth_dir)
    num_output_classes = len(char_to_int) # Total unique chars with the blank
    print(f"✅ Character to integer mapping created. Total classes (including <blank>): {num_output_classes}")
   
    # Step 2: Get image paths and labels
    image_paths, labels = get_image_paths_and_labels(images_base_dir, ground_truth_dir)
    print(f"✅ Found {len(image_paths)} image-label pairs.")
   
    if not image_paths:
        print("❌ ERROR: No image-label pairs found. Check your directory structure and file paths.")
    else:
        # Step 3: Split the data into Training and Validation sets
        train_paths, val_paths, train_labels, val_labels = train_test_split(
            image_paths, labels, test_size=0.1, random_state=42, stratify=None
        )
        print(f"✅ Data split: {len(train_paths)} training samples, {len(val_paths)} validation samples.")
       
        # Step 4: Create the TensorFlow datasets
        batch_size = 32

        # Note: char_to_int is accessible globally by the dataset function
        train_dataset = create_tf_dataset(train_paths, train_labels, batch_size)
        val_dataset = create_tf_dataset(val_paths, val_labels, batch_size)
       
        print("✅ TensorFlow Train and Validation datasets created.")
       
        # Step 5: Import and build the CRNN model
        from rcnn_model import build_crnn_model
       
        # input_shape is (Width, Height, Channels)
        input_shape = (INPUT_WIDTH, INPUT_HEIGHT, 1) 
       
        model = build_crnn_model(input_shape, num_output_classes)
        model.summary()
       
        # Step 7: Compile and Train the Model
        model.compile(
            optimizer=keras.optimizers.Adam(),
            loss=ctc_loss_func
        )
       
        print("\n--- Model Training Configuration ---")
        print("Model Compiled with Adam Optimizer and CTC Loss.")
       
        # Training Run
        history = model.fit(
            train_dataset,
            validation_data=val_dataset,
            epochs=50 # Example number of epochs
        )
        
        # Save the model after training
        model.save('final_crnn_model.h5')
        print("\n✅ Model saved.")
















# # data_pipeline.py
# import tensorflow as tf
# import os
# import glob

# def create_char_to_int_mapping(ground_truth_dir):
#     """
#     Creates a character-to-integer mapping from all ground truth files.
#     """
#     all_chars = set()
#     for filename in os.listdir(ground_truth_dir):
#         if filename.endswith(".txt"):
#             with open(os.path.join(ground_truth_dir, filename), 'r', encoding='utf-8') as f:
#                 text = f.read()
#                 all_chars.update(text)
    
#     sorted_chars = sorted(list(all_chars))
#     char_to_int = {char: i for i, char in enumerate(sorted_chars)}
#     int_to_char = {i: char for i, char in enumerate(sorted_chars)}
    
#     # Add a blank character for CTC loss
#     char_to_int['<blank>'] = len(char_to_int)
#     int_to_char[len(int_to_char)] = '<blank>'
    
#     return char_to_int, int_to_char, sorted_chars

# def get_image_paths_and_labels(images_base_dir, ground_truth_dir):
#     """
#     Gets a list of all image file paths and their corresponding ground truth labels.
#     """
#     image_paths = []
#     labels = []
    
#     # Iterate through each student's directory of segmented lines
#     for student_dir in glob.glob(os.path.join(images_base_dir, "*")):
#         if os.path.isdir(student_dir):
#             for img_path in glob.glob(os.path.join(student_dir, "*.png")):
#                 # Assuming the ground truth file has the same name but a .txt extension
#                 file_name = os.path.basename(img_path).replace(".png", ".txt")
#                 student_id = os.path.basename(student_dir)
#                 gt_path = os.path.join(ground_truth_dir, student_id, file_name)
                
#                 if os.path.exists(gt_path):
#                     with open(gt_path, 'r', encoding='utf-8') as f:
#                         label = f.read().strip()
#                         image_paths.append(img_path)
#                         labels.append(label)
                        
#     return image_paths, labels

# def create_tf_dataset(image_paths, labels, char_to_int, batch_size):
#     """
#     Creates a TensorFlow dataset pipeline.
#     """
#     # Create a dataset from image paths and labels
#     dataset = tf.data.Dataset.from_tensor_slices((image_paths, labels))
    
#     # Define a function to process each data point
#     def load_and_preprocess(image_path, label):
#         # Image processing
#         image = tf.io.read_file(image_path)
#         image = tf.image.decode_png(image, channels=1) # Decode to grayscale
#         image = tf.image.convert_image_dtype(image, tf.float32)
#         image = tf.image.resize(image, (32, 256)) # Resize to a consistent shape
#         image = tf.transpose(image, perm=[1, 0, 2]) # Transpose for RNN input
        
#         # Label encoding
#         label = tf.strings.unicode_split(label, input_encoding='UTF-8')
#         label = [char_to_int[char.numpy().decode('utf-8')] for char in label]
#         label = tf.cast(label, tf.int32)
        
#         return image, label

#     # Apply the processing function to the dataset
#     dataset = dataset.map(lambda x, y: tf.py_function(load_and_preprocess, [x, y], [tf.float32, tf.int32]),
#                           num_parallel_calls=tf.data.experimental.AUTOTUNE)
    
#     # Pad sequences to a consistent length
#     dataset = dataset.padded_batch(batch_size, padded_shapes=([256, 32, 1], [None]))
#     dataset = dataset.shuffle(buffer_size=1000)
#     dataset = dataset.prefetch(buffer_size=tf.data.experimental.AUTOTUNE)
    
#     return dataset

# # Main execution block
# if __name__ == "__main__":
#     # Define your directories
#     images_base_dir = "segmented_lines"
#     ground_truth_dir = "ground_truth_texts"
    
#     # Step 1: Create a character mapping
#     char_to_int, _, _ = create_char_to_int_mapping(ground_truth_dir)
#     print("✅ Character to integer mapping created.")
    
#     # Step 2: Get image paths and labels
#     image_paths, labels = get_image_paths_and_labels(images_base_dir, ground_truth_dir)
#     print(f"✅ Found {len(image_paths)} image-label pairs.")
    
#     # Step 3: Create the TensorFlow dataset
#     batch_size = 32
#     train_dataset = create_tf_dataset(image_paths, labels, char_to_int, batch_size)
#     print("✅ TensorFlow dataset created.")
    
#     # You can now use 'train_dataset' for model training.
#     # For example, you can iterate through the first batch to verify:
#     for images, labels in train_dataset.take(1):
#         print("\n--- Verifying a batch ---")
#         print(f"Batch image shape: {images.shape}")
#         print(f"Batch label shape: {labels.shape}")
#         print("-----------------------")