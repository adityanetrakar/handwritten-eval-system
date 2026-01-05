import cv2
import os
import numpy as np

def segment_lines(image_path, output_dir):
    """
    Segments a deskewed image into individual lines of text.
    
    Args:
        image_path (str): Path to the deskewed image.
        output_dir (str): Directory to save the segmented line images.
    """
    image = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if image is None:
        print(f"Error: Could not read image at {image_path}")
        return
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    # Invert for easier processing (white text on black background)
    inverted = cv2.bitwise_not(image)
    
    # Create a horizontal projection histogram
    histogram = np.sum(inverted, axis=1)
    
    # Find the start and end of each line (gaps in the histogram)
    line_starts = np.where(histogram > np.mean(histogram) * 0.1)[0]
    
    if len(line_starts) == 0:
        print("No lines detected in the image.")
        return
    
    # Group the line_starts into contiguous blocks
    line_boundaries = []
    if line_starts.size > 0:
        line_boundaries.append(line_starts[0])
        for i in range(1, len(line_starts)):
            if line_starts[i] > line_starts[i-1] + 1:
                line_boundaries.append(line_starts[i-1])
                line_boundaries.append(line_starts[i])
        line_boundaries.append(line_starts[-1])

    line_count = 0
    for i in range(0, len(line_boundaries) - 1, 2):
        start_y = line_boundaries[i]
        end_y = line_boundaries[i+1]
        
        # Add some padding
        padding = 10
        start_y = max(0, start_y - padding)
        end_y = min(image.shape[0], end_y + padding)
        
        line_image = image[start_y:end_y, :]
        
        if line_image.size > 0:
            line_count += 1
            line_path = os.path.join(output_dir, f"line_{line_count}.png")
            cv2.imwrite(line_path, line_image)
            print(f"Saved line {line_count} to {line_path}")

# Example usage:
# segment_lines("deskewed_images/page_1_deskewed.png", "segmented_lines")