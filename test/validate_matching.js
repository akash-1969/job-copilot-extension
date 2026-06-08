const path = require('path');
const fs = require('fs');

// Mock window context in Node
global.window = global;

// Load knowledge base files
const skills = require('../lib/kb/skills.json');
const synonyms = require('../lib/kb/synonyms.json');
const roleMappings = require('../lib/kb/roleMappings.json');
const inferredSkills = require('../lib/kb/inferredSkills.json');

global.JOB_COPILOT_SKILLS = skills;
global.JOB_COPILOT_SYNONYMS = synonyms;
global.JOB_COPILOT_ROLE_MAPPINGS = roleMappings;
global.JOB_COPILOT_INFERRED_SKILLS = inferredSkills;

// Load project modules
const jobUnderstanding = require('../lib/jobUnderstanding.js');
const matchEngine = require('../lib/matchEngine.js');

global.JobUnderstandingLayer = jobUnderstanding.JobUnderstandingLayer;
global.JobCopilotMatchEngine = matchEngine;

console.log("===============================================");
console.log("         JOBCOPILOT TEST SUITE SYSTEM          ");
console.log("===============================================\n");

let failedCount = 0;
let passedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedCount++;
  } else {
    console.log(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

// ----------------------------------------------------
// TEST CASE 1: Skill Normalization Layer
// ----------------------------------------------------
console.log("--- TEST CASE 1: Synonym Normalization ---");

const testNormalize = (raw, expected) => {
  const normalized = matchEngine.normalizeSkill(raw, synonyms);
  assert(normalized === expected, `"${raw}" normalizes to "${expected}" (Got: "${normalized}")`);
};

testNormalize("C++", "cpp");
testNormalize("C Plus Plus", "cpp");
testNormalize("c++", "cpp");
testNormalize("React.js", "react");
testNormalize("ReactJS", "react");
testNormalize("react js", "react");
testNormalize("Node.js", "nodejs");
testNormalize("NodeJS", "nodejs");
testNormalize("node js", "nodejs");
testNormalize("Java", "java");

console.log("");

// ----------------------------------------------------
// TEST CASE 2: Resume Parser Skill & Experience Extraction
// ----------------------------------------------------
console.log("--- TEST CASE 2: Resume Skill & Experience Extraction ---");

// Mock options.js parseResumeText logic
function mockParseResume(text) {
  const detected = new Set();
  const lowerText = text.toLowerCase();
  
  const getNormalized = (s) => {
    const clean = s.trim().toLowerCase();
    if (synonyms[clean]) return synonyms[clean].toLowerCase();
    if (clean === 'reactjs' || clean === 'react.js' || clean === 'react js') return 'react';
    if (clean === 'nodejs' || clean === 'node js' || clean === 'node.js' || clean === 'node') return 'nodejs';
    if (clean === 'c plus plus' || clean === 'cplusplus' || clean === 'c++') return 'cpp';
    return clean;
  };

  // 1. Scan entire resume
  skills.forEach(skill => {
    const escaped = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let regexStr;
    if (skill === 'c++') {
      regexStr = '(?:^|[^a-zA-Z0-9\\+#])c\\+\\+(?:$|[^a-zA-Z0-9\\+#])';
    } else if (skill === 'c#') {
      regexStr = '(?:^|[^a-zA-Z0-9\\+#])c\\#(?:$|[^a-zA-Z0-9\\+#])';
    } else if (skill === '.net') {
      regexStr = '(?:^|[^a-zA-Z0-9\\+#])\\.net(?:$|[^a-zA-Z0-9\\+#])';
    } else {
      regexStr = '\\b' + escaped + '\\b';
    }
    
    if (new RegExp(regexStr, 'i').test(lowerText)) {
      detected.add(getNormalized(skill));
    }
  });

  // 2. Scan synonyms list
  Object.keys(synonyms).forEach(syn => {
    const escaped = syn.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    let regexStr;
    if (syn === 'c++') {
      regexStr = '(?:^|[^a-zA-Z0-9\\+#])c\\+\\+(?:$|[^a-zA-Z0-9\\+#])';
    } else if (syn === 'c#') {
      regexStr = '(?:^|[^a-zA-Z0-9\\+#])c\\#(?:$|[^a-zA-Z0-9\\+#])';
    } else if (syn === '.net') {
      regexStr = '(?:^|[^a-zA-Z0-9\\+#])\\.net(?:$|[^a-zA-Z0-9\\+#])';
    } else {
      regexStr = '\\b' + escaped + '\\b';
    }
    
    if (new RegExp(regexStr, 'i').test(lowerText)) {
      detected.add(getNormalized(synonyms[syn]));
    }
  });

  // 3. Scan phrases
  const phrasesRegex = /(?:proficient in|experienced with|worked with|built projects using|familiar with|knowledge of)\s+([^.\n]+)/gi;
  let match;
  while ((match = phrasesRegex.exec(text)) !== null) {
    const skillsBlob = match[1];
    const splitSkills = skillsBlob.split(/[,;\t]|\s+and\s+|\s+or\s+|\s+&\s+/gi);
    splitSkills.forEach(rawSkill => {
      const cleanSkill = rawSkill.trim().replace(/^[\s\-–—\*\•]+|[\s\-–—\*\•]+$/g, '').trim();
      if (cleanSkill.length > 1 && cleanSkill.length < 30) {
        const cleanLower = cleanSkill.toLowerCase();
        detected.add(getNormalized(cleanLower));
      }
    });
  }

  // Map to display casing
  const finalSkills = Array.from(detected).map(skill => {
    if (skill === 'cpp') return 'C++';
    if (skill === 'nodejs') return 'Node.js';
    if (skill === 'react') return 'React';
    if (skill === 'javascript') return 'JavaScript';
    if (skill === 'typescript') return 'TypeScript';
    if (skill === 'c#') return 'C#';
    if (skill === '.net') return '.NET';
    if (skill === 'aws') return 'AWS';
    if (skill === 'git') return 'Git';

    const official = skills.find(s => s.toLowerCase() === skill.toLowerCase());
    if (official) return official.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return skill.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  });

  // Experience Parsing Heuristic
  let experienceYears = 0;
  const expRegex = /(?:^|\s)(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)\b/i;
  const expMatch = text.match(expRegex);
  if (expMatch) {
    experienceYears = parseInt(expMatch[1], 10);
  } else {
    const rangeRegex = /\b(19\d{2}|20[0-2]\d)\b\s*(?:-|–|—|to)\s*\b(19\d{2}|20[0-2]\d|present|current|now)\b/gi;
    let rangeMatch;
    let totalYears = 0;
    const currentYear = new Date().getFullYear();
    while ((rangeMatch = rangeRegex.exec(text)) !== null) {
      const startYear = parseInt(rangeMatch[1], 10);
      let endYearStr = rangeMatch[2].toLowerCase();
      let endYear = currentYear;
      if (/present|current|now/.test(endYearStr)) {
        endYear = currentYear;
      } else {
        endYear = parseInt(endYearStr, 10);
      }
      if (endYear >= startYear) {
        totalYears += (endYear - startYear);
      }
    }
    if (totalYears > 0) {
      experienceYears = Math.min(totalYears, 30);
    }
  }

  return { skills: finalSkills, experienceYears };
}

const mockResumeText = `
John Doe
Software Engineer
Email: john@example.com

SUMMARY:
Experienced software engineer with a strong background in C++ and Java.
Familiar with Docker and Git. 

TECHNICAL PROJECTS:
* Built a web dashboard. Worked with React.js and NodeJS for fullstack development.
* Experienced with AWS deployments.
`;

const parsedResume = mockParseResume(mockResumeText);
console.log("  Parsed Skills from Mock Resume:", parsedResume.skills);
console.log("  Parsed Experience from Mock Resume (no explicit phrase):", parsedResume.experienceYears);

assert(parsedResume.skills.includes("C++"), "Parser successfully extracts 'C++'");
assert(parsedResume.skills.includes("Java"), "Parser successfully extracts 'Java'");
assert(parsedResume.skills.includes("React"), "Parser successfully extracts 'React' (React.js synonym)");
assert(parsedResume.skills.includes("Node.js"), "Parser successfully extracts 'Node.js' (NodeJS synonym)");
assert(parsedResume.skills.includes("AWS"), "Parser successfully extracts 'AWS'");
assert(parsedResume.skills.includes("Docker"), "Parser successfully extracts 'Docker' (from familiar with)");

// Test explicit years extraction
const resumeTextWithExpPhrase = "Over 6+ years of experience building Python applications.";
const parsedExpPhrase = mockParseResume(resumeTextWithExpPhrase);
console.log("  Parsed Experience (explicit phrase):", parsedExpPhrase.experienceYears);
assert(parsedExpPhrase.experienceYears === 6, "Parser extracts 6 years from '6+ years of experience'");

// Test date ranges extraction
const resumeTextWithRanges = `
Work History:
Google (2018 - 2021)
Meta (2022 - present)
`;
const parsedExpRanges = mockParseResume(resumeTextWithRanges);
const currentYear = new Date().getFullYear();
const expectedYears = (2021 - 2018) + (currentYear - 2022);
console.log("  Parsed Experience (date ranges):", parsedExpRanges.experienceYears, `(Expected: ${expectedYears})`);
assert(parsedExpRanges.experienceYears === expectedYears, `Parser calculates ${expectedYears} years from date ranges`);

console.log("");

// ----------------------------------------------------
// TEST CASE 3: Job Description Experience & Skill Inference
// ----------------------------------------------------
console.log("--- TEST CASE 3: Job Description Experience & Skill Inference ---");

const jdData1 = {
  title: "Backend Engineer",
  locationText: "San Francisco, CA",
  description: "We are looking for a C++ developer to build REST APIs and microservices. You will set up CI/CD pipelines. Require at least 5 years of experience."
};

const analysis1 = jobUnderstanding.JobUnderstandingLayer.analyzeJob(jdData1);
console.log("  Extracted Required Experience (explicit text):", analysis1.requiredExperience);
assert(analysis1.requiredExperience === 5, "Successfully extracted 5 years of required experience from description text");
assert(analysis1.inferredSkills.includes("api design"), "Inferred 'api design' from REST APIs");
assert(analysis1.inferredSkills.includes("backend development"), "Inferred 'backend development' from REST APIs");
assert(analysis1.inferredSkills.includes("docker"), "Inferred 'docker' from microservices");
assert(analysis1.inferredSkills.includes("distributed systems"), "Inferred 'distributed systems' from microservices");
assert(analysis1.inferredSkills.includes("github actions") || analysis1.inferredSkills.includes("devops"), "Inferred DevOps/GitHub Actions from CI/CD");

// Test Title Seniority fallback
const jdDataSeniorFallback = {
  title: "Senior Full Stack Architect",
  locationText: "Remote",
  description: "Join our team to write clean code."
};
const analysisSenior = jobUnderstanding.JobUnderstandingLayer.analyzeJob(jdDataSeniorFallback);
console.log("  Inferred Required Experience (Senior title fallback):", analysisSenior.requiredExperience);
assert(analysisSenior.requiredExperience === 5, "Senior title fallback infers 5 years required experience");

const jdDataJuniorFallback = {
  title: "Junior Developer",
  locationText: "New York, NY",
  description: "Great entry level opportunity."
};
const analysisJunior = jobUnderstanding.JobUnderstandingLayer.analyzeJob(jdDataJuniorFallback);
console.log("  Inferred Required Experience (Junior title fallback):", analysisJunior.requiredExperience);
assert(analysisJunior.requiredExperience === 1, "Junior title fallback infers 1 year required experience");

console.log("");

// ----------------------------------------------------
// TEST CASE 4: Detailed Matching & Experience Scoring
// ----------------------------------------------------
console.log("--- TEST CASE 4: Detailed Match Verification & Experience Scoring ---");

const userProfile = {
  skills: parsedResume.skills.join(', '), // "C++, Java, React, Node.js, AWS, Docker, Git"
  targetRoles: "Backend Engineer",
  preferredLocation: "San Francisco, CA",
  remotePreference: "open",
  experienceYears: 3 // Candidate has 3 years experience
};

// JD requires 5 years (from jdData1)
const matchResult = matchEngine.calculateFullMatch(jdData1, userProfile);

console.log("  --- HUD Debug Output Simulator ---");
console.log("  Raw Resume Skills:", matchResult.debug.rawResumeSkills);
console.log("  Normalized Resume Skills:", matchResult.debug.normalizedResumeSkills);
console.log("  Raw Job Skills:", matchResult.debug.rawJobSkills);
console.log("  Normalized Job Skills:", matchResult.debug.normalizedJobSkills);
console.log("  Candidate Experience:", matchResult.candidateExperience);
console.log("  Required Experience:", matchResult.requiredExperience);
console.log("  Experience Match Score:", matchResult.breakdown.experience.score, "/ 15");
console.log("  Final Match Score:", matchResult.score);

assert(matchResult.matchedSkills.includes("cpp"), "C++ (cpp) is successfully MATCHED");
assert(matchResult.matchedSkills.includes("java"), "Java (java) is successfully MATCHED");
assert(matchResult.matchedSkills.includes("docker"), "Docker (docker) is successfully MATCHED");
assert(!matchResult.missingSkills.includes("cpp"), "C++ is not in missing skills");

// Experience Score Calculation check:
// Gap = 5 (required) - 3 (candidate) = 2.
// Score = 15 - 2 * 4 = 7.
assert(matchResult.breakdown.experience.score === 7, "Experience Score calculation is correct: Gap = 2 years -> 7 / 15 points");

// Exact match check:
const userProfileMatchExp = {
  ...userProfile,
  experienceYears: 5
};
const matchResultPerfectExp = matchEngine.calculateFullMatch(jdData1, userProfileMatchExp);
console.log("  Perfect Experience Match Score:", matchResultPerfectExp.breakdown.experience.score, "/ 15");
assert(matchResultPerfectExp.breakdown.experience.score === 15, "Perfect Experience Match awards full 15 points");

// Weight Breakdown Max check:
assert(matchResult.breakdown.skills.max === 30, "Skills match max score is correctly adjusted to 30");
assert(matchResult.breakdown.role.max === 25, "Role match max score is correctly adjusted to 25");
assert(matchResult.breakdown.experience.max === 15, "Experience match max score is 15");

console.log("");
console.log("===============================================");
console.log(` TEST RESULT SUMMARY: Passed: ${passedCount} | Failed: ${failedCount}`);
console.log("===============================================");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
