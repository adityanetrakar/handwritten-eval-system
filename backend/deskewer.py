import cv2
import numpy as np
import math

def deskew(image_path, output_path):
    """
    Detects and corrects the skew of an image.
    
    Args:
        image_path (str): Path to the input binarized image.
        output_path (str): Path to save the deskewed image.
    """
    # Load the image
    image = cv2.imread("image_path", cv2.IMREAD_GRAYSCALE)
    if image is None:
        print(f"Error: Could not read image at {image_path}")
        return

    # Invert the image if needed (black text on white background)
    inverted = cv2.bitwise_not(image)
    
    # Use a probabilistic Hough line transform to find text lines
    lines = cv2.HoughLinesP(inverted, 1, np.pi / 180, threshold=100, minLineLength=100, maxLineGap=20)
    
    if lines is None:
        print("No lines detected to calculate skew.")
        cv2.imwrite(output_path, image)
        return
        
    angles = []
    for line in lines:
        x1, y1, x2, y2 = line[0]
        # Calculate angle in radians
        angle = math.atan2(y2 - y1, x2 - x1)
        angles.append(math.degrees(angle))

    # Average the angles to get the skew
    skew_angle = np.median(angles)
    
    # Rotate the image to correct the skew
    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, skew_angle, 1.0)
    rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    cv2.imwrite(output_path, rotated)
    print(f"Deskewed image saved to {output_path} with angle: {skew_angle:.2f} degrees")

# Example usage:
# deskew("binarized_images/page_1_binarized.png", "deskewed_images/page_1_deskewed.png")