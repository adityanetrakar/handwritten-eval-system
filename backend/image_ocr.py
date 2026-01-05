# image_ocr.py

import cv2
import os
import easyocr
import glob

def binarize_image(image_path, output_path):
    """Binarizes an image using Otsu's thresholding."""
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        print(f"❌ Error: Could not read image at {image_path}")
        return False
    
    blur = cv2.GaussianBlur(img, (5, 5), 0)
    _, binary_img = cv2.threshold(blur, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    cv2.imwrite(output_path, binary_img)
    print(f"⚙️ Binarized image saved to {output_path}")
    return True

def perform_ocr_and_save(image_path, output_text_path):
    """Performs OCR on an image and saves the extracted text to a file."""
    reader = easyocr.Reader(['en'])
    results = reader.readtext(image_path)
    
    extracted_text = ""
    for (bbox, text, prob) in results:
        extracted_text += text + " "
    
    # Save the extracted text to a file
    with open(output_text_path, 'w', encoding='utf-8') as f:
        f.write(extracted_text)
    
    print(f"✅ Extracted text saved to {output_text_path}")

# Main workflow
input_dir = "processed_images"
output_image_dir = "binarized_images"
output_text_dir = "ocr_outputs" # Directory to save text files

if not os.path.exists(output_image_dir):
    os.makedirs(output_image_dir)

if not os.path.exists(output_text_dir):
    os.makedirs(output_text_dir)

# Get a list of all .png files in the directory
image_files = glob.glob(os.path.join(input_dir, "*.png"))

for image_file in sorted(image_files):
    print(f"\nProcessing {image_file}...")
    base_name = os.path.basename(image_file)
    binarized_path = os.path.join(output_image_dir, base_name)
    
    if binarize_image(image_file, binarized_path):
        # Determine the path for the output text file
        output_text_path = os.path.join(output_text_dir, base_name.replace(".png", ".txt"))
        perform_ocr_and_save(binarized_path, output_text_path)

print("\n✅ Initial OCR tests and text extraction completed.")