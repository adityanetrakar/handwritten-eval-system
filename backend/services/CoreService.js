require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const util = require('util');
const { exec } = require('child_process');

const natural = require('natural');
const Sentiment = require('sentiment');

const execPromise = util.promisify(exec);

// --- Gemini Client ---
if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in .env file');
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Globals for transformers ---
let sentenceTransformerModel = null;
let pipelineFunc = null;

// Load @xenova/transformers and initialize pipeline + model safely
async function loadTransformers() {
  try {
    const tf = await import("@xenova/transformers");
    pipelineFunc = tf.pipeline;

    console.log("Loading MiniLM sentence transformer model...");
    sentenceTransformerModel = await pipelineFunc(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );

    console.log("Sentence transformer loaded.");
  } catch (err) {
    console.error("Transformers failed to load:", err);
  }
}
loadTransformers();

// --- Helper Functions ---
function fileToGenerativePart(filePath, mimeType) {
  const fileBuffer = fs.readFileSync(filePath);
  return {
    inlineData: {
      data: fileBuffer.toString('base64'),
      mimeType,
    },
  };
}

// --- Text processing utilities ---
function preprocessText(text = '') {
  const tokenizer = new natural.WordTokenizer();
  const tokens = tokenizer.tokenize(String(text).toLowerCase());
  const stemmer = natural.PorterStemmer;
  return tokens.map(t => stemmer.stem(t));
}

function exactMatch(expectedAnswer = '', studentAnswer = '') {
  return String(expectedAnswer).trim().toLowerCase() === String(studentAnswer).trim().toLowerCase() ? 1 : 0;
}

function partialMatch(expectedAnswer = '', studentAnswer = '') {
  const expectedTokens = preprocessText(expectedAnswer);
  const studentTokens = preprocessText(studentAnswer);

  const expectedSet = new Set(expectedTokens);
  const studentSet = new Set(studentTokens);

  const commonTokens = Array.from(expectedSet).filter(token => studentSet.has(token));
  const denom = Math.max(expectedTokens.length, studentTokens.length) || 1;
  return commonTokens.length / denom;
}

function cosineSimilarityScore(expectedAnswer = '', studentAnswer = '') {
  const TfIdf = natural.TfIdf;
  const tfidf = new TfIdf();

  tfidf.addDocument(String(expectedAnswer));
  tfidf.addDocument(String(studentAnswer));

  const vector1 = [];
  const vector2 = [];
  const terms = new Set();

  tfidf.listTerms(0).forEach(item => terms.add(item.term));
  tfidf.listTerms(1).forEach(item => terms.add(item.term));

  const termArray = Array.from(terms);
  termArray.forEach(term => {
    vector1.push(tfidf.tfidf(term, 0));
    vector2.push(tfidf.tfidf(term, 1));
  });

  const dotProduct = vector1.reduce((s, v, i) => s + v * (vector2[i] || 0), 0);
  const magnitude1 = Math.sqrt(vector1.reduce((s, v) => s + v * v, 0));
  const magnitude2 = Math.sqrt(vector2.reduce((s, v) => s + v * v, 0));

  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}

const sentimentAnalyzer = new Sentiment();
function sentimentAnalysisScore(text = '') {
  const result = sentimentAnalyzer.analyze(String(text));
  // result.score is usually small range - normalize to [0,1]
  const normalized = (result.score + 5) / 10;
  return Math.max(0, Math.min(1, normalized));
}

async function enhancedSentenceMatch(expectedAnswer = '', studentAnswer = '') {
  // wait for model if not ready
  if (!sentenceTransformerModel) {
    if (pipelineFunc) {
      sentenceTransformerModel = await pipelineFunc('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    } else {
      // cannot compute embeddings: return 0.0 similarity fallback
      return 0;
    }
  }

  try {
    const embeddingExpected = await sentenceTransformerModel(String(expectedAnswer), {
      pooling: 'mean',
      normalize: true
    });
    const embeddingStudent = await sentenceTransformerModel(String(studentAnswer), {
      pooling: 'mean',
      normalize: true
    });

    // embeddings could be Float32Array or object with .data
    const vecA = embeddingExpected.data ? Array.from(embeddingExpected.data) : (Array.isArray(embeddingExpected) ? embeddingExpected : []);
    const vecB = embeddingStudent.data ? Array.from(embeddingStudent.data) : (Array.isArray(embeddingStudent) ? embeddingStudent : []);

    if (vecA.length === 0 || vecB.length === 0) return 0;
    return cosineSimilarityBetweenVectors(vecA, vecB);
  } catch (err) {
    console.warn('Error in enhancedSentenceMatch:', err);
    return 0;
  }
}

function cosineSimilarityBetweenVectors(vec1 = [], vec2 = []) {
  const dotProduct = vec1.reduce((s, v, i) => s + v * (vec2[i] || 0), 0);
  const magnitude1 = Math.sqrt(vec1.reduce((s, v) => s + v * v, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((s, v) => s + v * v, 0));
  if (magnitude1 === 0 || magnitude2 === 0) return 0;
  return dotProduct / (magnitude1 * magnitude2);
}

function multinomialNaiveBayesScore(expectedAnswer = '', studentAnswer = '') {
  const expectedTokens = preprocessText(expectedAnswer);
  const studentTokens = preprocessText(studentAnswer);

  const expectedSet = new Set(expectedTokens);
  const studentSet = new Set(studentTokens);

  const overlap = Array.from(studentSet).filter(token => expectedSet.has(token)).length;
  const denom = Math.max(expectedSet.size, studentSet.size) || 1;
  return overlap / denom;
}

function coherenceScore(expectedAnswer = '', studentAnswer = '') {
  const tokenizer = new natural.WordTokenizer();
  const lenExpected = tokenizer.tokenize(String(expectedAnswer)).length;
  const lenStudent = tokenizer.tokenize(String(studentAnswer)).length;

  if (lenExpected === 0 && lenStudent === 0) return 1;
  if (lenExpected === 0 || lenStudent === 0) return 0;
  return Math.min(lenExpected, lenStudent) / Math.max(lenExpected, lenStudent);
}

function relevanceScore(expectedAnswer = '', studentAnswer = '') {
  const tokenizer = new natural.WordTokenizer();
  const expectedTokens = new Set(tokenizer.tokenize(String(expectedAnswer).toLowerCase()));
  const studentTokens = new Set(tokenizer.tokenize(String(studentAnswer).toLowerCase()));

  if (expectedTokens.size === 0) return 0;
  const commonTokens = Array.from(expectedTokens).filter(token => studentTokens.has(token));
  return commonTokens.length / expectedTokens.size;
}

function weightedAverageScore(scores, weights) {
  const weightedSum = scores.reduce((sum, score, i) => sum + score * weights[i], 0);
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  return weightedSum / totalWeight;
}

async function evaluate(expectedAnswer, studentAnswer) {
  expectedAnswer = String(expectedAnswer || '');
  studentAnswer = String(studentAnswer || '');

  if (expectedAnswer.trim() === studentAnswer.trim()) return 10;
  if (!studentAnswer || studentAnswer.trim() === '') return 0;

  const exactMatchScore = exactMatch(expectedAnswer, studentAnswer);
  const partialMatchScore = partialMatch(expectedAnswer, studentAnswer);
  const cosineSimScore = cosineSimilarityScore(expectedAnswer, studentAnswer);
  const sentimentScore = sentimentAnalysisScore(studentAnswer);
  const enhancedMatchScore = await enhancedSentenceMatch(expectedAnswer, studentAnswer);
  const naiveBayesScore = multinomialNaiveBayesScore(expectedAnswer, studentAnswer);
  const semanticSimScore = enhancedMatchScore;
  const coherence = coherenceScore(expectedAnswer, studentAnswer);
  const relevance = relevanceScore(expectedAnswer, studentAnswer);

  const scores = [
    exactMatchScore,
    partialMatchScore,
    cosineSimScore,
    sentimentScore,
    enhancedMatchScore,
    naiveBayesScore,
    semanticSimScore,
    coherence,
    relevance
  ];

  const weights = [0.001, 0.8, 0.02, 0.001, 0.90, 0.003, 0.70, 0.001, 0.02];
  const scaledScores = scores.map(s => (typeof s === 'number' ? s * 10 : 0));
  const finalScore = weightedAverageScore(scaledScores, weights);
  const roundedScore = Math.round(finalScore);

  console.log('Exact Match Score:', exactMatchScore);
  console.log('Partial Match Score:', partialMatchScore);
  console.log('Cosine Similarity Score:', cosineSimScore);
  console.log('Sentiment Score:', sentimentScore);
  console.log('Enhanced Sentence Match Score:', enhancedMatchScore);
  console.log('Multinomial Naive Bayes Score:', naiveBayesScore);
  console.log('Semantic Similarity Score:', semanticSimScore);
  console.log('Coherence Score:', coherence);
  console.log('Relevance Score:', relevance);
  console.log('Final Score:', roundedScore);

  return roundedScore;
}

// --- Core Service Functions ---

/**
 * JOB 1: Convert a PDF into a set of images
 * @param {string} pdfPath - The path to the uploaded PDF (e.g., 'uploads/myfile.pdf')
 * @returns {Array<string>} An array of paths to the converted image files (e.g., ['/tmp/page.1.png', ...])
 */
const convertPdfToImages = async (pdfPath) => {
  const tempSavePath = path.join(__dirname, '..', 'temp'); // /backend/temp
  await fs.ensureDir(tempSavePath); // Ensure the temp folder exists

  const baseName = path.basename(pdfPath, '.pdf');
  
  // ImageMagick uses '%d' to number pages (e.g., my-file-0.png, my-file-1.png)
  const outputPattern = path.join(tempSavePath, `${baseName}-%d.png`);

  // Check if on Windows (uses 'magick convert') or Mac/Linux (uses 'convert')
  const commandPrefix = os.platform() === 'win32' ? 'magick' : 'convert';
  
  // Build the exact command we tested manually. We quote paths to handle spaces.
  const command = `${commandPrefix} -density 300 "${pdfPath}" -quality 100 "${outputPattern}"`;

  console.log(`Executing command: ${command}`);

  try {
    // 1. Execute the command
    await execPromise(command);

    // 2. Find the files that were just created
    const allFiles = await fs.readdir(tempSavePath);
    
    // 3. Filter for the images we just created
    const imageFiles = allFiles
      .filter(f => f.startsWith(baseName) && f.endsWith('.png'))
      .map(f => path.join(tempSavePath, f)); // Get their full paths

    if (imageFiles.length === 0) {
      throw new Error('ImageMagick ran, but no images were created.');
    }

    console.log(`PDF converted to ${imageFiles.length} images.`);
    return imageFiles;

  } catch (error) {
    // This will give us a much better error message
    console.error('Error during manual PDF conversion:', error.stderr || error.message);
    throw new Error(`PDF conversion failed: ${error.stderr || error.message}`);
  }
};

/**
 * JOB 2: Extract handwritten text from a single image
 * @param {string} imagePath - The path to a single image file (e.g., '/tmp/page.1.png')
 * @returns {string} The extracted text from that image
 */
const extractTextFromImage = async (imagePath) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    // This new prompt asks for ALL text, not just handwritten.
    const prompt = `
        Extract ALL HANDWRITTEN TEXT from this exam page.
        VERY IMPORTANT RULES:
        - Preserve line breaks
        - Preserve numbering (1., 2., a), b), etc.)
        - Transcribe handwriting as accurately as possible
        - Do NOT summarize
        - Do NOT skip faint or unclear text
        - If a word is unclear, write "(?)"
        - Output ONLY the raw extracted text
      `;  
    const imagePart = fileToGenerativePart(imagePath, 'image/png');

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error in extractTextFromImage:', error);
    return ''; // Return empty string on failure
  }
};

const gradeAnswerSemantically = async (modelAnswer, studentAnswer, maxMarks) => {
  try {
    const rawScore = await evaluate(modelAnswer, studentAnswer);
    const scaledScore = Math.round((rawScore / 10) * maxMarks);
    const percentage = (rawScore / 10) * 100;
    let feedback;
    if (percentage >= 90) feedback = 'Excellent answer! Very close to the model answer.';
    else if (percentage >= 75) feedback = 'Good answer. Covers most key points.';
    else if (percentage >= 60) feedback = 'Satisfactory answer. Some important points covered.';
    else if (percentage >= 40) feedback = 'Partial answer. Missing several key concepts.';
    else if (percentage > 0) feedback = 'Needs improvement. Answer lacks key information.';
    else feedback = 'No answer provided or completely incorrect.';
    return { score: 1+scaledScore, feedback };
  } catch (error) {
    console.error('Error in gradeAnswerSemantically:', error);
    return { score: 0, feedback: 'Error: The evaluation algorithm failed to process this answer.' };
  }
};

const parseTextToModelAnswer = async (rawText) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const prompt = `
      You are a data extraction bot. Your task is to read the following text from a university-level model answer paper and convert it into a structured JSON array.
      **Raw Text to Parse:**
      """
      ${rawText}
      """
    `;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Error in parseTextToModelAnswer:', error);
    return [];
  }
};

const extractUsnFromImage = async (imagePath) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const prompt = `
      You are an OCR engine specialized in extracting student USN / roll number.
      Extract ONLY the USN-like pattern from the image.

      Valid USN formats look like:
      - 1BM22CS017
      - Numeric + letters combination

      STRICT RULES:
      - Output ONLY the USN value
      - No extra text
      - No labels
      - No explanation
      - If you cannot read the USN clearly → return "UNKNOWN"
    `;
    
    const imagePart = fileToGenerativePart(imagePath, 'image/png');
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    let usn = response.text().trim().toUpperCase();
    
    if (usn.length > 20 || usn.length < 3) {
      return "UNKNOWN"; // Filter out nonsensical responses
    }

    const regex = /[0-9]{1}[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{3}|[0-9]{2}[A-Z]{2}[0-9]{3}|[A-Z0-9]{5,15}/;
    const match = usn.match(regex);

    return match ? match[0] : "UNKNOWN";
    
  } catch (error) {
    console.error('Error in extractUsnFromImage:', error);
    return "UNKNOWN";
  }
};

/**
 * JOB 6: Parse raw student answer text into a structured object.
 * @param {string} rawText - The full, raw text from the student's answer pages.
 * @param {Array<string>} questionNumbers - An array of question numbers from the model key (e.g., ["1a", "1b", "2"])
 * @returns {Object} An object mapping question numbers to answers (e.g., {"1a": "...", "1b": "..."})
 */
const parseStudentAnswers = async (rawText, questionNumbers) => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });
    const questionList = questionNumbers.join(', '); // e.g., "1a, 1b, 2"
    
    const prompt = `
      You are a data extraction bot. Read the following raw text from a student's answer script.
      Your task is to map the answers to the correct question numbers. The questions we are looking for are: [${questionList}].
      
      **Rules:**
      1.  Go through the text and identify which answer belongs to which question number.
      2.  Return *only* a valid JSON object where keys are the question numbers from the list and values are the student's answer text for that question.
      3.  If a student did not answer a question from the list, you *must* include the key but set the value to an empty string "".
      
      **Raw Text:**
      """
      ${rawText}
      """

      **Example Output (JSON Object only):**
      {
        "1a": "The student's answer for 1a...",
        "1b": "This is the answer for 1b.",
        "2": ""
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Clean the text output
    const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(jsonString);

    // Ensure all questions are present, even if empty
    const finalAnswers = {};
    for (const qNum of questionNumbers) {
      finalAnswers[qNum] = parsedData[qNum] || "";
    }
    return finalAnswers;

  } catch (error) {
    console.error('Error in parseStudentAnswers:', error);
    // On failure, return an object with empty answers
    const finalAnswers = {};
    for (const qNum of questionNumbers) {
      finalAnswers[qNum] = "";
    }
    return finalAnswers;
  }
};


const { execFile } = require('child_process');

/**
 * callDataPipeline(scriptArg)
 *   await callDataPipeline('--info');
 *   await callDataPipeline('/path/to/some/file.pdf');
 */
function callDataPipeline(arg) {
  return new Promise((resolve, reject) => {
    try {
      // compute script absolute path (assumes project root)
      const scriptPath = path.join(__dirname, '..', 'data_pipeline.py');

      if (!fs.existsSync(scriptPath)) {
        return reject(new Error(`data_pipeline.py not found at ${scriptPath}`));
      }

      // find python executable (use 'python' or 'python3' depending on environment)
      const pythonCmd = process.env.PYTHON_BIN || 'python';

      // If arg is an array allow multiple args; normalize to array
      const args = Array.isArray(arg) ? arg : (arg ? [String(arg)] : []);

      // execFile is safer than exec (no shell)
      execFile(pythonCmd, [scriptPath, ...args], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
          // include stderr to help debugging
          const e = new Error(`Python call failed: ${err.message}${stderr ? ' | stderr: ' + stderr : ''}`);
          e.stderr = stderr;
          return reject(e);
        }
        // try to parse JSON output; if not JSON, return raw text
        const out = String(stdout || '').trim();
        try {
          const parsed = out ? JSON.parse(out) : {};
          return resolve(parsed);
        } catch (parseErr) {
          // not JSON — still resolve with raw output
          return resolve({ raw: out });
        }
      });
    } catch (ex) {
      return reject(ex);
    }
  });
}




module.exports = {
  convertPdfToImages,
  extractTextFromImage,
  gradeAnswerSemantically,
  parseTextToModelAnswer,
  extractUsnFromImage,
  parseStudentAnswers,
};
