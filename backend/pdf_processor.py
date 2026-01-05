import fitz
import os

def pdf_to_images(pdf_path, output_dir):
    """Converts each page of a PDF file to a high-resolution image."""
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    doc = fitz.open(pdf_path)
    for page_num in range(doc.page_count):
        page = doc.load_page(page_num)
        zoom = 3  # Higher zoom for better resolution
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)
        image_path = os.path.join(output_dir, f"page_{page_num + 1}.png")
        pix.save(image_path)
    doc.close()
    print(f"✅ Successfully converted all pages of {pdf_path} to images in {output_dir}")

# Call the function for your file
pdf_to_images("AnswerScripts/23CS060.pdf", "processed_images")