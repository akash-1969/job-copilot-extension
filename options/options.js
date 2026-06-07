// Configure PDF.js Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '../lib/pdf.worker.min.js';

// DOM Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.getElementById('browse-btn');
const uploadStatus = document.getElementById('upload-status');
const saveBtn = document.getElementById('save-btn');
const toast = document.getElementById('toast');

// Form Input Elements
const formFields = {
  fullName: document.getElementById('fullName'),
  email: document.getElementById('email'),
  phone: document.getElementById('phone'),
  linkedin: document.getElementById('linkedin'),
  github: document.getElementById('github'),
  portfolio: document.getElementById('portfolio'),
  university: document.getElementById('university'),
  degree: document.getElementById('degree'),
  skills: document.getElementById('skills'),
  targetRoles: document.getElementById('targetRoles'),
  preferredLocation: document.getElementById('preferredLocation'),
  remotePreference: document.getElementById('remotePreference'),
  rawResumeText: document.getElementById('rawResumeText')
};

// Initialize Options Page
document.addEventListener('DOMContentLoaded', loadProfile);

// Save Profile button listener
saveBtn.addEventListener('click', saveProfile);

// File upload listeners
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

// Drag & Drop event listeners
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const files = e.dataTransfer.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
});

// Load profile from chrome.storage.local
function loadProfile() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['profile', 'rawResumeText'], (result) => {
      if (result.profile) {
        Object.keys(formFields).forEach(key => {
          if (key === 'rawResumeText') {
            formFields[key].value = result.rawResumeText || '';
          } else {
            formFields[key].value = result.profile[key] || (key === 'remotePreference' ? 'open' : '');
          }
        });
      }
    });
  } else {
    console.warn("Chrome Storage API is not available (running outside extension context).");
  }
}

// Save profile to chrome.storage.local
function saveProfile() {
  const profile = {
    fullName: formFields.fullName.value.trim(),
    email: formFields.email.value.trim(),
    phone: formFields.phone.value.trim(),
    linkedin: formFields.linkedin.value.trim(),
    github: formFields.github.value.trim(),
    portfolio: formFields.portfolio.value.trim(),
    university: formFields.university.value.trim(),
    degree: formFields.degree.value.trim(),
    skills: formFields.skills.value.trim(),
    targetRoles: formFields.targetRoles.value.trim(),
    preferredLocation: formFields.preferredLocation.value.trim(),
    remotePreference: formFields.remotePreference.value
  };
  const rawResumeText = formFields.rawResumeText.value;

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ profile, rawResumeText }, () => {
      showToast('Profile Saved Successfully!');
    });
  } else {
    showToast('Saved (Simulation Mode - No Chrome API)', true);
  }
}

// Show Toast Alert
function showToast(message, isInfo = false) {
  toast.innerText = message;
  toast.style.background = isInfo ? '#3b82f6' : '#10b981';
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Handle File Input Selection
function handleFileSelect(e) {
  const files = e.target.files;
  if (files.length > 0) {
    processFile(files[0]);
  }
}

// Reconstruct lines of a PDF page based on item coordinates
function reconstructLinesFromPdfPage(textContent) {
  const items = textContent.items;
  if (!items || items.length === 0) return '';
  
  // Sort items primarily by Y-coordinate descending (top of page to bottom),
  // and secondarily by X-coordinate ascending (left to right).
  // Use a threshold of 6 units for matching items on the same line.
  const threshold = 6;
  const activeItems = items.filter(it => it.str && it.str.trim().length > 0);
  
  activeItems.sort((a, b) => {
    const yA = a.transform[5];
    const yB = b.transform[5];
    const xA = a.transform[4];
    const xB = b.transform[4];
    
    const yDiff = yB - yA;
    if (Math.abs(yDiff) < threshold) {
      return xA - xB;
    }
    return yDiff;
  });
  
  const lines = [];
  let currentY = null;
  let currentLineItems = [];
  
  for (const item of activeItems) {
    const y = item.transform[5];
    
    if (currentY === null) {
      currentY = y;
      currentLineItems.push(item);
    } else if (Math.abs(currentY - y) < threshold) {
      currentLineItems.push(item);
    } else {
      currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
      lines.push(currentLineItems.map(it => it.str).join(' '));
      
      currentY = y;
      currentLineItems = [item];
    }
  }
  
  if (currentLineItems.length > 0) {
    currentLineItems.sort((a, b) => a.transform[4] - b.transform[4]);
    lines.push(currentLineItems.map(it => it.str).join(' '));
  }
  
  return lines.join('\n');
}

// Process PDF File
function processFile(file) {
  if (file.type !== 'application/pdf') {
    showStatus('Please upload a valid PDF file.', 'error');
    return;
  }

  showStatus('Reading PDF file...', 'info');

  const reader = new FileReader();
  reader.onload = async function() {
    try {
      const typedarray = new Uint8Array(this.result);
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = reconstructLinesFromPdfPage(textContent);
        fullText += pageText + '\n';
      }

      if (!fullText.trim()) {
        throw new Error('No readable text found in PDF resume.');
      }

      showStatus('Extracting text and parsing details...', 'info');
      parseResumeText(fullText);
      showStatus('Resume parsed! Please review the details below.', 'success');
    } catch (error) {
      console.error(error);
      showStatus('Error parsing PDF: ' + error.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// Display upload status message
function showStatus(msg, type) {
  uploadStatus.innerText = msg;
  uploadStatus.className = 'status-msg ' + type;
}

// Heuristic Resume Parsing
function parseResumeText(text) {
  // Save raw text
  formFields.rawResumeText.value = text;

  // Split text into lines/words for better contextual processing
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Email Extraction
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i;
  const emailMatch = text.match(emailRegex);
  formFields.email.value = emailMatch ? emailMatch[0] : '';

  // 2. Phone Extraction
  const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phoneMatches = text.match(phoneRegex);
  formFields.phone.value = phoneMatches ? phoneMatches[0] : '';

  // 3. URLs
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9-_\/]+/i;
  const githubRegex = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9-_\/]+/i;
  const genericUrlRegex = /(https?:\/\/[^\s\(\)\[\]\{\}]+)/g;

  const linkedinMatch = text.match(linkedinRegex);
  formFields.linkedin.value = linkedinMatch ? linkedinMatch[0] : '';

  const githubMatch = text.match(githubRegex);
  formFields.github.value = githubMatch ? githubMatch[0] : '';

  const allUrls = text.match(genericUrlRegex) || [];
  let portfolioUrl = '';
  for (let url of allUrls) {
    const isLinkedIn = /linkedin/i.test(url);
    const isGitHub = /github/i.test(url);
    const isPdfResource = /\.pdf/i.test(url);
    if (!isLinkedIn && !isGitHub && !isPdfResource) {
      portfolioUrl = url;
      break;
    }
  }
  formFields.portfolio.value = portfolioUrl;

  // 4. Full Name Heuristic
  // Capitalized line in the first 5 lines containing only letters, spaces, dots, hyphens
  let candidateName = '';
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const line = lines[i].replace(/\s+/g, ' ').trim();
    if (/resume|cv|curriculum vitae|curriculum|portfolio|page\s*\d/i.test(line)) continue;
    
    const hasDigits = /\d/.test(line);
    const hasAt = /@/.test(line);
    const hasHttp = /http|www/i.test(line);
    const hasSpecialChar = /[^a-zA-Z\s\.\-]/g.test(line);
    
    const words = line.split(/\s+/).filter(w => w.length > 0);
    if (words.length < 1 || words.length > 4) continue;
    
    const isCapitalized = words.every(w => {
      if (w.length <= 3 && /^[a-z]+$/.test(w)) return true; // allow structural names like "de", "von"
      return /^[A-Z]/.test(w);
    });
    
    if (line.length >= 3 && line.length <= 35 && !hasDigits && !hasAt && !hasHttp && !hasSpecialChar && isCapitalized) {
      candidateName = line;
      break;
    }
  }

  // Fallback name search: relax capitalization
  if (!candidateName) {
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const line = lines[i].replace(/\s+/g, ' ').trim();
      if (/resume|cv|curriculum vitae|curriculum|portfolio|page\s*\d/i.test(line)) continue;
      
      const hasDigits = /\d/.test(line);
      const hasAt = /@/.test(line);
      const hasHttp = /http|www/i.test(line);
      const hasSpecialChar = /[^a-zA-Z\s\.\-]/g.test(line);
      
      const words = line.split(/\s+/);
      if (words.length >= 2 && words.length <= 4 && line.length >= 3 && line.length <= 35 && !hasDigits && !hasAt && !hasHttp && !hasSpecialChar) {
        candidateName = line;
        break;
      }
    }
  }
  formFields.fullName.value = candidateName;

  // 5 & 6. University & Degree Smart Heuristic
  let university = '';
  let degree = '';

  const uniKeywords = /\b(university|college|institute|school|academy|polytechnic|iit|nit|bits)\b/i;
  const degKeywords = /\b(bachelor|master|phd|doctor|b\.s\.|m\.s\.|b\.a\.|m\.a\.|b\.tech|m\.tech|b\.e\.|m\.e\.|bca|mca|bba|mba|degree|major|minor)\b/i;

  for (let line of lines) {
    const cleanLine = line.replace(/\s+/g, ' ').trim();
    const hasUni = uniKeywords.test(cleanLine);
    const hasDeg = degKeywords.test(cleanLine);

    if (hasUni && hasDeg) {
      // Split same-line values (e.g. "Bachelor of Technology, Indian Institute of Technology")
      const parts = cleanLine.split(/[,|\-–—\t]|\s+at\s+|\s+from\s+/i);
      let foundUni = '';
      let foundDeg = '';

      for (let part of parts) {
        const trimmed = part.trim();
        const pHasUni = uniKeywords.test(trimmed);
        const pHasDeg = degKeywords.test(trimmed);

        if (pHasUni && !pHasDeg && !foundUni) {
          foundUni = trimmed;
        } else if (pHasDeg && !pHasUni && !foundDeg) {
          foundDeg = trimmed;
        }
      }

      if (foundUni) university = foundUni;
      if (foundDeg) degree = foundDeg;

      if (university && degree) break;
    } else if (hasUni && !hasDeg && !university) {
      university = cleanLine;
    } else if (hasDeg && !hasUni && !degree) {
      degree = cleanLine;
    }
  }

  // Clean-up formatting if bleed is detected
  if (university && degKeywords.test(university)) {
    const match = university.match(/([A-Z][a-zA-Z\s]+ (?:University|College|Institute|School|Academy|Polytechnic))/i);
    if (match) {
      university = match[0].trim();
    }
  }

  if (degree && uniKeywords.test(degree)) {
    const parts = degree.split(/[,|\-–—\t]|\s+at\s+|\s+from\s+/i);
    for (let part of parts) {
      if (degKeywords.test(part) && !uniKeywords.test(part)) {
        degree = part.trim();
        break;
      }
    }
  }

  formFields.university.value = university.trim();
  formFields.degree.value = degree.trim();

  // 7. Skills Heuristic
  const commonSkills = [
    'JavaScript', 'Python', 'React', 'HTML', 'CSS', 'Node.js', 'TypeScript', 'Java', 'C++',
    'SQL', 'Git', 'Docker', 'AWS', 'Ruby', 'PHP', 'Swift', 'Kotlin', 'Go', 'Rust',
    'Kubernetes', 'Project Management', 'Data Analysis', 'Machine Learning', 'AI', 'UI/UX'
  ];
  
  let detectedSkills = [];
  const cleanLines = lines.map(line => line.replace(/\s+/g, ' ').trim());
  for (let i = 0; i < cleanLines.length; i++) {
    const line = cleanLines[i];
    if (/^(skills|technical skills|languages|technologies|proficiencies|core competencies)/i.test(line)) {
      const segment = cleanLines.slice(i, i + 3).join(', ');
      let cleanSeg = segment.replace(/skills|technical|languages|technologies|proficiencies|core competencies/ig, '');
      cleanSeg = cleanSeg.replace(/^[:\s\-–—]+/, '').trim();
      if (cleanSeg.length > 5) {
        detectedSkills.push(cleanSeg);
        break;
      }
    }
  }

  const matchedCommon = commonSkills.filter(skill => {
    const wordRegex = new RegExp('\\b' + skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\b', 'i');
    return wordRegex.test(text);
  });

  if (detectedSkills.length > 0) {
    formFields.skills.value = detectedSkills.join(', ');
  } else {
    formFields.skills.value = matchedCommon.join(', ');
  }
}
