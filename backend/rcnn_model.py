# Main Python that defines CRNN model

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras.layers import Conv2D, MaxPooling2D, Bidirectional, LSTM, Dense, Reshape, TimeDistributed, Activation, BatchNormalization

def build_crnn_model(input_shape, num_classes):
    """
    Builds a CRNN model for handwritten text recognition.
    
    Args:
        input_shape (tuple): The shape of the input images (height, width, channels).
        num_classes (int): The number of unique characters in your dataset + 1 for CTC blank.
    """
    # CNN Part (Feature Extractor)
    inputs = keras.Input(shape=input_shape)
    
    # Block 1
    x = Conv2D(64, (3, 3), activation='relu', padding='same')(inputs)
    x = MaxPooling2D(pool_size=(2, 2), strides=(2, 2))(x)
    x = BatchNormalization()(x)
    
    # Block 2
    x = Conv2D(128, (3, 3), activation='relu', padding='same')(x)
    x = MaxPooling2D(pool_size=(2, 2), strides=(2, 2))(x)
    x = BatchNormalization()(x)
    
    # Block 3
    x = Conv2D(256, (3, 3), activation='relu', padding='same')(x)
    x = Conv2D(256, (3, 3), activation='relu', padding='same')(x)
    x = MaxPooling2D(pool_size=(2, 1), strides=(2, 1))(x) # Pool size change for feature sequence
    x = BatchNormalization()(x)
    
    # Block 4
    x = Conv2D(512, (3, 3), activation='relu', padding='same')(x)
    x = Conv2D(512, (3, 3), activation='relu', padding='same')(x)
    x = MaxPooling2D(pool_size=(2, 1), strides=(2, 1))(x)
    x = BatchNormalization()(x)

    # Convert CNN output to a sequence for the RNN
    new_shape = ((input_shape[0] // 8), (input_shape[1] // 4) * 512)
    x = Reshape(target_shape=new_shape)(x)
    
    # RNN Part (Sequence Processor)
    x = Bidirectional(LSTM(256, return_sequences=True))(x)
    x = Bidirectional(LSTM(256, return_sequences=True))(x)

    # Output Layer
    outputs = Dense(num_classes + 1, activation='softmax')(x)
    
    # Final Model
    model = keras.Model(inputs=inputs, outputs=outputs)
    
    return model

# Example usage (you'll adjust these for your data)
# input_shape = (32, 256, 1) # height, width, channels (1 for grayscale)
# num_classes = 80 # number of unique characters in your dataset
# model = build_crnn_model(input_shape, num_classes)
# model.summary()