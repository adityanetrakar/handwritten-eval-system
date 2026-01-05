import distance
import os

def calculate_cer(ground_truth, extracted_text):
    """Calculates Character Error Rate (CER)."""
    # Replace any newline or extra spaces
    ground_truth = ground_truth.replace('\n', ' ').strip()
    extracted_text = extracted_text.replace('\n', ' ').strip()
    
    # Calculate Levenshtein distance and normalize by ground truth length
    return distance.levenshtein(ground_truth, extracted_text) / len(ground_truth)

def calculate_wer(ground_truth, extracted_text):
    """Calculates Word Error Rate (WER)."""
    ground_truth_words = ground_truth.split()
    extracted_text_words = extracted_text.split()
    
    # Calculate Levenshtein distance on words
    return distance.levenshtein(ground_truth_words, extracted_text_words) / len(ground_truth_words)

def evaluate_ocr(ground_truth_dir, ocr_output_dir):
    """
    Evaluates OCR performance by comparing extracted text to ground truth.
    
    Args:
        ground_truth_dir (str): Directory containing ground truth text files.
        ocr_output_dir (str): Directory containing OCR output text files.
    """
    total_cer = 0
    total_wer = 0
    num_pages = 0

    for filename in os.listdir(ground_truth_dir):
        if filename.endswith(".txt"):
            ground_truth_path = os.path.join(ground_truth_dir, filename)
            ocr_output_path = os.path.join(ocr_output_dir, filename)

            if not os.path.exists(ocr_output_path):
                print(f"Skipping {filename}: OCR output not found.")
                continue

            with open(ground_truth_path, 'r', encoding='utf-8') as gt_file:
                ground_truth = gt_file.read()

            with open(ocr_output_path, 'r', encoding='utf-8') as ocr_file:
                extracted_text = ocr_file.read()

            cer = calculate_cer(ground_truth, extracted_text)
            wer = calculate_wer(ground_truth, extracted_text)
            
            print(f"📄 Page {filename}:")
            print(f"  Character Error Rate (CER): {cer:.2f}")
            print(f"  Word Error Rate (WER): {wer:.2f}")
            
            total_cer += cer
            total_wer += wer
            num_pages += 1
            
    if num_pages > 0:
        avg_cer = total_cer / num_pages
        avg_wer = total_wer / num_pages
        print("\n--- Summary ---")
        print(f"Overall Average CER: {avg_cer:.2f}")
        print(f"Overall Average WER: {avg_wer:.2f}")

# Example usage (you will need to prepare these directories)
# evaluate_ocr("ground_truth_texts", "ocr_outputs")