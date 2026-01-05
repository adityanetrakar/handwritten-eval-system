# preprocessing_pipeline.py

import os
import glob # Used for finding files easily
import cv2

# Import functions from your other scripts
# Assuming you've created these files and functions as discussed
from deskewer import deskew
from line_segment import segment_lines

def run_preprocessing_pipeline(input_dir, deskewed_dir, segmented_dir):
    """
    Orchestrates the entire image preprocessing pipeline.

    Args:
        input_dir (str): Directory containing the binarized images.
        deskewed_dir (str): Directory to save deskewed images.
        segmented_dir (str): Directory to save segmented line images.
    """
    if not os.path.exists(deskewed_dir):
        os.makedirs(deskewed_dir)

    if not os.path.exists(segmented_dir):
        os.makedirs(segmented_dir)
        
    print("--- Starting Preprocessing Pipeline ---")
    
    # 1. Deskewing
    print("Step 1: Deskewing images...")
    input_images = glob.glob(os.path.join(input_dir, "*.png"))
    for img_path in sorted(input_images):
        base_name = os.path.basename(img_path)
        deskewed_path = os.path.join(deskewed_dir, base_name)
        deskew(img_path, deskewed_path)

    print("✅ All images have been deskewed.")
    
    # 2. Line Segmentation
    print("Step 2: Segmenting lines...")
    deskewed_images = glob.glob(os.path.join(deskewed_dir, "*.png"))
    for img_path in sorted(deskewed_images):
        base_name = os.path.basename(img_path).replace(".png", "")
        # Create a subdirectory for each page's segmented lines
        page_segmented_dir = os.path.join(segmented_dir, base_name)
        segment_lines(img_path, page_segmented_dir)

    print("✅ All lines have been segmented.")
    print("--- Preprocessing Pipeline Complete ---")

# Main execution block
if __name__ == "__main__":
    # Define your directories
    input_directory = "binarized_images" # This should contain your binarized images from the last step
    deskewed_directory = "deskewed_images"
    segmented_directory = "segmented_lines"
    
    run_preprocessing_pipeline(input_directory, deskewed_directory, segmented_directory)