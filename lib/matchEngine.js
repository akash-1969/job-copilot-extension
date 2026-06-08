// JobCopilot Local Match Engine

// Master list of common skills to extract requirements from job descriptions (tech and non-tech)
const COMMON_SKILLS = [
  'javascript', 'python', 'react', 'node.js', 'typescript', 'java', 'c++', 'c#', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'sql', 'nosql', 'mongodb', 'postgresql', 'mysql', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'git', 'html', 'css', 'sass', 'vue', 'angular', 'svelte', 'express', 'django', 'flask', 'spring boot', 'graphql', 'rest api', 'ci/cd', 'terraform', 'jenkins', 'linux', 'unix', 'c', 'assembly', 'scala', 'clojure', 'haskell', 'perl', 'objective-c', 'dart', 'flutter', 'react native', 'redux', 'webpack', 'vite', 'next.js', 'nuxt.js', 'redis', 'elasticsearch', 'firebase', 'sqlite', 'oracle', 'mariadb', 'dynamodb', 'tailwind css', 'bootstrap', 'jquery', 'pandas', 'numpy', 'scikit-learn', 'tensorflow', 'pytorch', 'keras', 'opencv', 'tableau', 'power bi', 'spark', 'hadoop', 'jira', 'confluence', 'agile', 'scrum', 'figma', 'canva', 'adobe xd', 'photoshop', 'illustrator', 'ui/ux', 'seo', 'sem', 'copywriting', 'content creation', 'project management', 'product management', 'data analysis', 'machine learning', 'artificial intelligence', 'deep learning', 'nlp', 'cybersecurity', 'network administration', 'system administration', 'quality assurance', 'qa', 'manual testing', 'automated testing', 'selenium', 'cypress', 'jest', 'mocha', 'chai', 'playwright', 'appium', 'solidity', 'blockchain', 'web3', 'cryptography',
  // Non-technical/general categories
  'recruiting', 'talent acquisition', 'onboarding', 'employee relations', 'hr policies', 'conflict resolution', 'hris',
  'process improvement', 'reporting', 'excel', 'operations management', 'workflow optimization',
  'sales', 'negotiation', 'lead generation', 'crm', 'cold calling', 'account management', 'business development',
  'customer service', 'customer support', 'relationship management', 'client retention', 'troubleshooting',
  'inventory management', 'staff scheduling', 'retail operations', 'merchandising', 'team leadership', 'store operations',
  'communication', 'problem solving'
];

function getSkillsList() {
  if (window.JOB_COPILOT_SKILLS && window.JOB_COPILOT_SKILLS.length > 0) {
    return window.JOB_COPILOT_SKILLS;
  }
  return COMMON_SKILLS;
}

function normalizeSkill(skill, synonyms) {
  if (!skill) return '';
  const clean = skill.trim().toLowerCase();
  
  if (synonyms && synonyms[clean]) {
    return synonyms[clean].toLowerCase();
  }
  
  // Fallbacks
  const noSpaces = clean.replace(/\s+/g, '');
  if (noSpaces === 'c++' || noSpaces === 'cplusplus' || noSpaces === 'cpp') return 'cpp';
  if (noSpaces === 'c#' || noSpaces === 'csharp') return 'c#';
  if (noSpaces === 'reactjs' || noSpaces === 'react.js' || noSpaces === 'react') return 'react';
  if (noSpaces === 'nodejs' || noSpaces === 'node.js' || noSpaces === 'node') return 'nodejs';
  if (noSpaces === 'dotnet' || noSpaces === '.net') return '.net';
  if (noSpaces === 'tensorflow' || noSpaces === 'tensor-flow') return 'tensorflow';
  if (noSpaces === 'pytorch' || noSpaces === 'py-torch') return 'pytorch';
  if (noSpaces === 'golang') return 'go';
  if (noSpaces === 'k8s') return 'kubernetes';
  if (noSpaces === 'amazonwebservices' || noSpaces === 'aws') return 'aws';
  
  return clean;
}

function extractSkillsFromProfile(skillsText, synonyms) {
  if (!skillsText) return [];
  
  const detected = new Set();
  const lowerText = skillsText.toLowerCase();
  
  // 1. Scan for any known skill
  const skillsList = getSkillsList();
  skillsList.forEach(skill => {
    if (skillMatchRegex(lowerText, skill)) {
      detected.add(normalizeSkill(skill, synonyms));
    }
  });
  
  // 2. Scan synonyms
  Object.keys(synonyms).forEach(syn => {
    if (skillMatchRegex(lowerText, syn)) {
      detected.add(normalizeSkill(synonyms[syn], synonyms));
    }
  });
  
  // 3. Fallback: split by comma to preserve custom skills
  skillsText.split(',').forEach(s => {
    const clean = s.trim();
    if (clean.length > 0) {
      detected.add(normalizeSkill(clean, synonyms));
    }
  });
  
  return Array.from(detected).filter(s => s.length > 0);
}

// Helper to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

// Custom regex search helper to deal with special characters in skills like C++, C#, .NET
function skillMatchRegex(text, skill) {
  const escaped = escapeRegex(skill);
  let regexStr;
  
  if (skill === 'c++') {
    regexStr = '(?:^|[^a-zA-Z0-9\\+#])c\\s*\\+\\s*\\+(?:$|[^a-zA-Z0-9\\+#])';
  } else if (skill === 'c#') {
    regexStr = '(?:^|[^a-zA-Z0-9\\+#])c\\s*\\#(?:$|[^a-zA-Z0-9\\+#])';
  } else if (skill === '.net') {
    regexStr = '(?:^|[^a-zA-Z0-9\\+#])\\.\\s*net(?:$|[^a-zA-Z0-9\\+#])';
  } else {
    regexStr = '\\b' + escaped + '\\b';
  }
  
  return new RegExp(regexStr, 'i').test(text);
}

// Parse remote preference from text
function detectRemoteStatus(text) {
  const lower = text.toLowerCase();
  if (/\bremote\b|\bwork from home\b|\bwfh\b|\btelecommute\b/i.test(lower)) {
    return 'remote';
  }
  if (/\bhybrid\b|\bremote\/on-site\b/i.test(lower)) {
    return 'hybrid';
  }
  if (/\bon-site\b|\bhybrid\/on-site\b|\bin-office\b|\bonsite\b|\boffice\b/i.test(lower)) {
    return 'onsite';
  }
  return 'open';
}

// Helper to calculate Role Match score based on explicit target roles or fallback skills/degree keywords
function matchRoleScore(titleLower, targetRoles, userProfile) {
  if (targetRoles.length === 0) {
    // Fallback: search for keywords in title that align with user's skills or degree
    const skillsLower = (userProfile.skills || '').toLowerCase();
    const degreeLower = (userProfile.degree || '').toLowerCase();
    
    const isCsDegree = /computer|science|software|software engineering|it|information technology/i.test(degreeLower);
    const hasTechSkills = skillsLower.length > 5;
    
    if (titleLower.includes('software') || titleLower.includes('engineer') || titleLower.includes('developer') || titleLower.includes('programmer')) {
      if (isCsDegree) return 25;
      if (hasTechSkills) return 20;
      return 10;
    } else if (titleLower.includes('backend') || titleLower.includes('server')) {
      if (skillsLower.includes('node') || skillsLower.includes('python') || skillsLower.includes('java') || skillsLower.includes('sql') || skillsLower.includes('django')) {
        return 25;
      }
      return 10;
    } else if (titleLower.includes('frontend') || titleLower.includes('web') || titleLower.includes('client')) {
      if (skillsLower.includes('javascript') || skillsLower.includes('react') || skillsLower.includes('html') || skillsLower.includes('css')) {
        return 25;
      }
      return 10;
    } else if (titleLower.includes('ml') || titleLower.includes('machine learning') || titleLower.includes('ai') || titleLower.includes('artificial') || titleLower.includes('data scientist')) {
      if (skillsLower.includes('python') || skillsLower.includes('pytorch') || skillsLower.includes('tensorflow') || skillsLower.includes('machine learning') || skillsLower.includes('learning')) {
        return 25;
      }
      return 10;
    }
    return 10; // Baseline neutral score for generic/unclassified roles
  }

  let bestRoleMatch = 0;
  for (const role of targetRoles) {
    const roleLower = role.toLowerCase();
    if (titleLower === roleLower) {
      return 25;
    } else if (titleLower.includes(roleLower) || roleLower.includes(titleLower)) {
      bestRoleMatch = Math.max(bestRoleMatch, 20);
    } else {
      // Token overlap
      const stopWords = ['engineer', 'developer', 'intern', 'co-op', 'specialist', 'associate', 'senior', 'junior', 'lead', 'staff', 'principal', 'in', 'of', 'and', 'for'];
      const roleWords = roleLower.split(/\s+/).filter(w => !stopWords.includes(w) && w.length > 1);
      const titleWords = titleLower.split(/\s+/).filter(w => !stopWords.includes(w) && w.length > 1);
      
      const intersection = roleWords.filter(w => titleWords.includes(w));
      if (intersection.length > 0) {
        const overlapScore = Math.min(25, 12 + intersection.length * 4);
        bestRoleMatch = Math.max(bestRoleMatch, overlapScore);
      } else if (titleLower.includes('intern') && roleLower.includes('intern')) {
        bestRoleMatch = Math.max(bestRoleMatch, 8);
      }
    }
  }
  return bestRoleMatch;
}

// Helper to count occurrences of a phrase in a text
function countOccurrences(text, phrase) {
  if (!text || !phrase) return 0;
  const escaped = escapeRegex(phrase);
  const regex = new RegExp('\\b' + escaped + '\\b', 'gi');
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

// Generate comprehensive career insights
function generateCareerInsights(jobDetails, userProfile, analysis, matchDetails) {
  const description = jobDetails.description || '';
  const descLower = description.toLowerCase();
  
  const synonyms = window.JOB_COPILOT_SYNONYMS || {};
  const userSkills = (userProfile.skills || '').split(',').map(s => normalizeSkill(s.trim(), synonyms)).filter(s => s.length > 0);
  
  const explicitReq = analysis.extractedSkills || [];
  const inferredReq = analysis.inferredSkills || [];
  
  const { explicitMatched, explicitMissing, inferredMatched, inferredMissing, roleScore, locScore, remoteScore, expScore } = matchDetails;
  
  // 1. Strengths
  const strengths = [];
  explicitMatched.forEach(skill => {
    strengths.push({
      skill: skill,
      count: countOccurrences(descLower, skill),
      type: 'explicit'
    });
  });
  inferredMatched.forEach(skill => {
    // If not counted in explicit
    if (!strengths.some(s => s.skill === skill)) {
      strengths.push({
        skill: skill,
        count: 0,
        type: 'inferred'
      });
    }
  });
  
  // 2. Missing Skills & Explainability
  const missingSkills = [];
  explicitMissing.forEach(skill => {
    const count = countOccurrences(descLower, skill);
    let impact = 'Medium';
    let explain = '';
    
    if (count >= 3) {
      impact = 'High';
      explain = `Found in ${count} locations across the job description.`;
    } else {
      explain = `Referenced in the job requirements.`;
    }
    
    missingSkills.push({
      skill: skill,
      count: count,
      impact: impact,
      explain: explain
    });
  });
  
  inferredMissing.forEach(skill => {
    if (!missingSkills.some(s => s.skill === skill)) {
      missingSkills.push({
        skill: skill,
        count: 0,
        impact: 'Optional',
        explain: `Standard requirement implied by the ${analysis.roleDetected} role.`
      });
    }
  });
  
  // Sort missing skills by impact (High -> Medium -> Optional)
  const impactOrder = { High: 0, Medium: 1, Optional: 2 };
  missingSkills.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);
  
  // 3. Potential Match Improvements (Match Progression Path)
  const potentialMatchPath = [];
  let currentScore = matchDetails.finalScore;
  
  potentialMatchPath.push({
    label: 'Current Profile',
    addedSkill: '',
    score: currentScore
  });
  
  let runningUserSkills = [...userSkills];
  const topMissing = missingSkills.slice(0, 4); // top 4 progression steps
  
  topMissing.forEach(item => {
    runningUserSkills.push(item.skill);
    
    // Recalculate skill score
    let newSkillScore = 0;
    const expMatchedNew = explicitReq.filter(s => runningUserSkills.includes(s));
    const infMatchedNew = inferredReq.filter(s => runningUserSkills.includes(s));
    
    if (explicitReq.length > 0) {
      const explicitScore = Math.round((expMatchedNew.length / explicitReq.length) * 20);
      const inferredScore = inferredReq.length > 0 ? Math.round((infMatchedNew.length / inferredReq.length) * 10) : 10;
      newSkillScore = explicitScore + inferredScore;
    } else {
      newSkillScore = inferredReq.length > 0 ? Math.round((infMatchedNew.length / inferredReq.length) * 30) : 30;
    }
    
    const newFinalScore = Math.min(100, newSkillScore + roleScore + locScore + remoteScore + expScore);
    
    potentialMatchPath.push({
      label: `Add ${item.skill.toUpperCase()}`,
      addedSkill: item.skill,
      score: newFinalScore
    });
  });
  
  // 4. Resume Phrasing Enhancements
  const resumeEnhancements = [];
  
  const phrasingRules = [
    {
      check: () => userSkills.includes('node.js') && (descLower.includes('api') || descLower.includes('backend') || descLower.includes('rest')),
      skill: 'node.js',
      text: 'Highlight backend API development, RESTful endpoint design, and server-side logic achievements more prominently.'
    },
    {
      check: () => userSkills.includes('react') && (descLower.includes('frontend') || descLower.includes('ui') || descLower.includes('interface') || descLower.includes('ux')),
      skill: 'react',
      text: 'Showcase React component architecture, state management (Redux/Context), and responsive web interface developments.'
    },
    {
      check: () => userSkills.includes('sql') && (descLower.includes('database') || descLower.includes('sql') || descLower.includes('query')),
      skill: 'sql',
      text: 'Emphasize SQL relational database schema design, query optimization, indexing, and data modeling skills.'
    },
    {
      check: () => userSkills.includes('git') && (descLower.includes('team') || descLower.includes('collaboration') || descLower.includes('agile')),
      skill: 'git',
      text: 'Feature collaborative Git workflows (Pull Requests, code reviews, branching models) and Agile team experience.'
    },
    {
      check: () => userSkills.includes('aws') && (descLower.includes('cloud') || descLower.includes('deploy') || descLower.includes('infrastructure')),
      skill: 'aws',
      text: 'Highlight AWS cloud deployment, serverless hosting, and scalable cloud infrastructure maintenance.'
    },
    {
      check: () => userSkills.includes('docker') && (descLower.includes('container') || descLower.includes('deploy') || descLower.includes('cicd')),
      skill: 'docker',
      text: 'Promote containerization, Docker packaging, and continuous integration pipeline deployments.'
    },
    {
      check: () => userSkills.includes('python') && (descLower.includes('analysis') || descLower.includes('data') || descLower.includes('pandas')),
      skill: 'python',
      text: 'Highlight Python data analysis scripting, workflow automation, and Pandas data manipulation.'
    }
  ];
  
  phrasingRules.forEach(rule => {
    if (rule.check()) {
      resumeEnhancements.push({
        skill: rule.skill,
        text: rule.text
      });
    }
  });
  
  // Generic fallbacks (pick matched skills that are explicit in JD)
  if (resumeEnhancements.length < 2) {
    const commonMatches = explicitMatched.filter(s => !resumeEnhancements.some(r => r.skill === s));
    for (const skill of commonMatches) {
      if (resumeEnhancements.length >= 3) break;
      resumeEnhancements.push({
        skill: skill,
        text: `Emphasize hands-on project accomplishments and production use-cases using ${skill.toUpperCase()} to match JD requirements.`
      });
    }
  }
  
  // 5. Missing Keywords (top common skills in JD that are not in user profile)
  const missingKeywords = getSkillsList()
    .filter(skill => !userSkills.includes(skill))
    .map(skill => ({
      skill: skill,
      count: countOccurrences(descLower, skill)
    }))
    .filter(item => item.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)
    .map(item => item.skill);
    
  return {
    strengths: strengths,
    missingSkills: missingSkills,
    potentialMatchPath: potentialMatchPath,
    resumeEnhancements: resumeEnhancements,
    missingKeywords: missingKeywords
  };
}

/**
 * Calculates Estimated Match Score based ONLY on card metadata
 * Weight distribution: Inferred Skill (40), Role (30), Location (15), Remote (15). Max = 100 points.
 */
function calculateEstimatedMatch(jobCardData, userProfile) {
  const { title, locationText } = jobCardData;
  const synonyms = window.JOB_COPILOT_SYNONYMS || {};
  const userSkills = extractSkillsFromProfile(userProfile.skills, synonyms);
  const targetRoles = (userProfile.targetRoles || '').split(',').map(r => r.trim()).filter(r => r.length > 0);
  const preferredLocation = (userProfile.preferredLocation || '').trim();
  const remotePreference = userProfile.remotePreference || 'open';
  
  let skillScore = 0;
  let roleScore = 0;
  let locScore = 0;
  let remoteScore = 0;
  let expScore = 15;
  
  const titleLower = title.toLowerCase();
  
  // 1. Inferred Skill Match (Max 30) using the central classification from Job Understanding Layer
  const classify = window.classifyRoleByTitle || (() => null);
  const roleKey = classify(title);
  
  const kb = window.JOB_COPILOT_ROLE_MAPPINGS || window.ROLE_KNOWLEDGE_BASE || { software: [] };
  let inferredSkills = [];
  if (roleKey && kb[roleKey]) {
    inferredSkills = kb[roleKey];
  } else {
    inferredSkills = [];
  }
  
  // Always append language if explicitly in title
  const languages = ['c++', 'c#', 'java', 'python', 'javascript', 'typescript', 'go', 'rust', 'ruby', 'swift', 'kotlin'];
  languages.forEach(lang => {
    if (titleLower.includes(lang) && !inferredSkills.includes(lang)) {
      inferredSkills = [...inferredSkills, lang];
    }
  });

  const normalizedInferred = inferredSkills.map(s => normalizeSkill(s, synonyms)).filter(s => s.length > 0);
  const matchedInferred = normalizedInferred.filter(s => userSkills.includes(s));
  skillScore = normalizedInferred.length > 0 ? Math.round((matchedInferred.length / normalizedInferred.length) * 30) : 30;
  
  // 2. Role Match (Max 25)
  roleScore = matchRoleScore(titleLower, targetRoles, userProfile);
  
  // 3. Location Match (Max 15)
  if (!preferredLocation) {
    locScore = 15;
  } else {
    const prefLocLower = preferredLocation.toLowerCase();
    const locLower = locationText.toLowerCase();
    
    if (locLower.includes(prefLocLower) || prefLocLower.includes(locLower)) {
      locScore = 15;
    } else {
      const stateMatch = prefLocLower.match(/\b([a-z]{2})\b/);
      if (stateMatch && locLower.includes(stateMatch[0])) {
        locScore = 10;
      }
    }
  }
  
  // 4. Remote Match (Max 15)
  if (remotePreference === 'open') {
    remoteScore = 15;
  } else {
    const jobRemote = detectRemoteStatus(locationText + ' ' + title);
    
    if (jobRemote === 'open') {
      remoteScore = 15;
    } else if (jobRemote === remotePreference) {
      remoteScore = 15;
    } else if (remotePreference === 'remote' && jobRemote === 'hybrid') {
      remoteScore = 8;
    } else if (remotePreference === 'hybrid' && jobRemote === 'remote') {
      remoteScore = 10;
    } else {
      remoteScore = 0;
    }
  }
  
  // 5. Experience Match (Max 15)
  const candidateExp = userProfile.experienceYears || 0;
  let requiredExp = 2; // fallback
  if (titleLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('sr ') || titleLower.includes('lead') || titleLower.includes('principal') || titleLower.includes('staff') || titleLower.includes('architect') || titleLower.includes('manager')) {
    requiredExp = 5;
  } else if (titleLower.includes('junior') || titleLower.includes('jr.') || titleLower.includes('jr ') || titleLower.includes('entry') || titleLower.includes('associate') || titleLower.includes('intern') || titleLower.includes('co-op')) {
    requiredExp = 1;
  }
  
  if (candidateExp < requiredExp) {
    const gap = requiredExp - candidateExp;
    expScore = Math.max(0, 15 - gap * 4);
  }
  
  const rawScore = skillScore + roleScore + locScore + remoteScore + expScore;
  
  return {
    score: rawScore,
    breakdown: {
      skills: { score: skillScore, max: 30, pct: Math.round((skillScore / 30) * 100) },
      role: { score: roleScore, max: 25, pct: Math.round((roleScore / 25) * 100) },
      location: { score: locScore, max: 15, pct: Math.round((locScore / 15) * 100) },
      remote: { score: remoteScore, max: 15, pct: Math.round((remoteScore / 15) * 100) },
      experience: { score: expScore, max: 15, pct: Math.round((expScore / 15) * 100) }
    }
  };
}

/**
 * Calculates Full Match Score including Skills parsed via Decoupled Job Understanding Layer
 * Weight distribution: Skill (40), Role (30), Location (15), Remote (15). Max = 100 points.
 */
function calculateFullMatch(jobDetailsData, userProfile) {
  const { title, locationText, description } = jobDetailsData;
  const synonyms = window.JOB_COPILOT_SYNONYMS || {};
  const userSkills = extractSkillsFromProfile(userProfile.skills, synonyms);
  const targetRoles = (userProfile.targetRoles || '').split(',').map(r => r.trim()).filter(r => r.length > 0);
  const preferredLocation = (userProfile.preferredLocation || '').trim();
  const remotePreference = userProfile.remotePreference || 'open';
  
  let skillScore = 0;
  let roleScore = 0;
  let locScore = 0;
  let remoteScore = 0;
  let expScore = 15;
  
  const titleLower = title.toLowerCase();
  
  // 1. Invoke Pluggable Job Understanding Layer
  const understandingLayer = window.JobUnderstandingLayer || {
    analyzeJob: () => ({
      roleDetected: 'unknown',
      requiredExperience: 2,
      extractedSkills: [],
      inferredSkills: [],
      confidence: 50,
      providerUsed: 'kb',
      aiTriggered: false
    })
  };
  
  const analysis = understandingLayer.analyzeJob(jobDetailsData);
  const explicitReq = analysis.extractedSkills || [];
  const inferredReq = analysis.inferredSkills || [];
  
  const explicitMatched = explicitReq.filter(s => userSkills.includes(s));
  const explicitMissing = explicitReq.filter(s => !userSkills.includes(s));
  
  const inferredMatched = inferredReq.filter(s => userSkills.includes(s));
  const inferredMissing = inferredReq.filter(s => !userSkills.includes(s));
  
  // Scoring weights: Explicit (20 pts max), Inferred (10 pts max)
  // Fallback: If no explicit skills are present in the job description, Inferred takes the full 30 pts
  if (explicitReq.length > 0) {
    const explicitScore = Math.round((explicitMatched.length / explicitReq.length) * 20);
    const inferredScore = inferredReq.length > 0 ? Math.round((inferredMatched.length / inferredReq.length) * 10) : 10;
    skillScore = explicitScore + inferredScore;
  } else {
    skillScore = inferredReq.length > 0 ? Math.round((inferredMatched.length / inferredReq.length) * 30) : 30;
  }
  
  // 2. Role Match (Max 25)
  roleScore = matchRoleScore(titleLower, targetRoles, userProfile);
  
  // 3. Location Match (Max 15)
  if (!preferredLocation) {
    locScore = 15;
  } else {
    const prefLocLower = preferredLocation.toLowerCase();
    const locLower = locationText.toLowerCase();
    
    if (locLower.includes(prefLocLower) || prefLocLower.includes(locLower)) {
      locScore = 15;
    } else {
      const stateMatch = prefLocLower.match(/\b([a-z]{2})\b/);
      if (stateMatch && locLower.includes(stateMatch[0])) {
        locScore = 10;
      }
    }
  }
  
  // 4. Remote Match (Max 15)
  let detectedRemote = detectRemoteStatus(locationText + ' ' + title);
  if (detectedRemote === 'open') {
    detectedRemote = detectRemoteStatus(description);
  }
  
  if (remotePreference === 'open') {
    remoteScore = 15;
  } else {
    if (detectedRemote === 'open') {
      remoteScore = 15;
    } else if (detectedRemote === remotePreference) {
      remoteScore = 15;
    } else if (remotePreference === 'remote' && detectedRemote === 'hybrid') {
      remoteScore = 8;
    } else if (remotePreference === 'hybrid' && detectedRemote === 'remote') {
      remoteScore = 10;
    } else {
      remoteScore = 0;
    }
  }
  
  // 5. Experience Match (Max 15)
  const candidateExp = userProfile.experienceYears || 0;
  const requiredExp = analysis.requiredExperience !== undefined ? analysis.requiredExperience : 2;
  if (candidateExp < requiredExp) {
    const gap = requiredExp - candidateExp;
    expScore = Math.max(0, 15 - gap * 4);
  }
  
  const finalScore = skillScore + roleScore + locScore + remoteScore + expScore;
  
  // 6. Generate Explanation Text
  let explanation = '';
  const isRoleSummarized = explicitReq.length === 0;
  if (isRoleSummarized) {
    explanation = '[Role-inferred requirements] ';
  }
  
  if (finalScore >= 85) {
    explanation += 'Excellent match! ';
  } else if (finalScore >= 70) {
    explanation += 'Good match. ';
  } else {
    explanation += 'Partial match. ';
  }
  
  if (explicitMatched.length > 0) {
    explanation += `Matches ${explicitMatched.length} key required skills (${explicitMatched.slice(0, 3).map(s => s.toUpperCase()).join(', ')}${explicitMatched.length > 3 ? '...' : ''}). `;
  }
  if (inferredMatched.length > 0) {
    explanation += `Aligns with inferred role expectations (${inferredMatched.slice(0, 3).map(s => s.toUpperCase()).join(', ')}${inferredMatched.length > 3 ? '...' : ''}). `;
  }
  
  const missingSummary = [...explicitMissing, ...inferredMissing];
  if (missingSummary.length > 0) {
    explanation += `Missing: ${missingSummary.slice(0, 3).map(s => s.toUpperCase()).join(', ')}${missingSummary.length > 3 ? '...' : ''}. `;
  }
  
  if (roleScore >= 20) {
    explanation += `Job title aligns well with your preferred roles. `;
  }
  if (remoteScore === 15 && remotePreference !== 'open') {
    explanation += `Matches your remote preference (${remotePreference.toUpperCase()}). `;
  }
  if (expScore === 15) {
    explanation += `Experience requirement met (Job: ${requiredExp} yrs, You: ${candidateExp} yrs).`;
  } else {
    explanation += `Experience gap detected: Job requires ${requiredExp} yrs, you have ${candidateExp} yrs.`;
  }
  
  const matchDetails = {
    finalScore,
    explicitMatched,
    explicitMissing,
    inferredMatched,
    inferredMissing,
    roleScore,
    locScore,
    remoteScore,
    expScore
  };

  const careerInsights = generateCareerInsights(jobDetailsData, userProfile, analysis, matchDetails);

  const missingReasons = {};
  explicitMissing.forEach(s => {
    missingReasons[s] = `Skill '${s}' was explicitly requested in the job description, but your resume skills (normalized: [${userSkills.join(', ')}]) do not contain its normalized form ('${s}').`;
  });
  inferredMissing.forEach(s => {
    missingReasons[s] = `Skill '${s}' was inferred from job responsibilities or role expectations, but your resume skills (normalized: [${userSkills.join(', ')}]) do not contain its normalized form ('${s}').`;
  });

  return {
    score: finalScore,
    explicitMatched: explicitMatched,
    explicitMissing: explicitMissing,
    inferredMatched: inferredMatched,
    inferredMissing: inferredMissing,
    matchedSkills: [...explicitMatched, ...inferredMatched],
    missingSkills: [...explicitMissing, ...inferredMissing],
    isRoleSummarized: isRoleSummarized,
    remoteStatus: detectedRemote,
    requiredExperience: requiredExp,
    candidateExperience: candidateExp,
    experienceScore: expScore,
    breakdown: {
      skills: { score: skillScore, max: 30, pct: Math.round((skillScore / 30) * 100) },
      role: { score: roleScore, max: 25, pct: Math.round((roleScore / 25) * 100) },
      location: { score: locScore, max: 15, pct: Math.round((locScore / 15) * 100) },
      remote: { score: remoteScore, max: 15, pct: Math.round((remoteScore / 15) * 100) },
      experience: { score: expScore, max: 15, pct: Math.round((expScore / 15) * 100) }
    },
    explanation: explanation.trim(),
    
    // Decoupled analysis details for UI explainability
    roleDetected: analysis.roleDetected,
    confidence: analysis.confidence,
    providerUsed: analysis.providerUsed,
    aiTriggered: analysis.aiTriggered,
    aiTriggerReason: analysis.aiTriggerReason,
    
    // Phase 5 Career Insights
    careerInsights: careerInsights,

    // Debugging info
    debug: {
      rawResumeSkills: (userProfile.skills || '').split(',').map(s => s.trim()).filter(s => s.length > 0),
      normalizedResumeSkills: userSkills,
      rawJobSkills: [...(analysis.rawExtractedSkills || []), ...(analysis.rawInferredSkills || [])],
      normalizedJobSkills: [...(analysis.extractedSkills || []), ...(analysis.inferredSkills || [])],
      missingReasons: missingReasons
    }
  };
}

/**
 * Aggregates visible page jobs to compute skills demand, role/work mode distribution,
 * hiring locations, score brackets, and runs profile simulation to estimate learning impact.
 */
function calculateMarketInsights(detectedJobs, userProfile, jobMatchCache) {
  if (!detectedJobs || detectedJobs.length === 0) {
    return null;
  }
  
  const totalJobs = detectedJobs.length;
  const userSkills = extractSkillsFromProfile(userProfile.skills, window.JOB_COPILOT_SYNONYMS || {});
  
  const skillsCount = {};
  const roleCount = {};
  const modeCount = { remote: 0, hybrid: 0, onsite: 0 };
  const locationCount = {};
  const matchDistribution = {
    high90: 0,
    med80: 0,
    avg70: 0,
    low60: 0,
    below60: 0
  };
  
  let totalScoreSum = 0;
  
  // Helper to extract clean location
  const cleanLocation = (loc) => {
    if (!loc) return 'Open / Remote';
    // Remove relative time bullet suffix (common on LinkedIn, e.g. "San Francisco, CA • 1 hour ago")
    let cleaned = loc.split('•')[0].split('(')[0].trim();
    if (!cleaned) return 'Open / Remote';
    return cleaned;
  };
  
  detectedJobs.forEach(job => {
    totalScoreSum += job.score;
    
    // 1. Bracket Match Distribution
    if (job.score >= 90) matchDistribution.high90++;
    else if (job.score >= 80) matchDistribution.med80++;
    else if (job.score >= 70) matchDistribution.avg70++;
    else if (job.score >= 60) matchDistribution.low60++;
    else matchDistribution.below60++;
    
    // 2. Location
    const loc = cleanLocation(job.locationText);
    locationCount[loc] = (locationCount[loc] || 0) + 1;
    
    // 3. Retrieve details (from cache if clicked, else run light titles analysis)
    const cached = jobMatchCache ? jobMatchCache.get(job.jobId) : null;
    let skills = [];
    let role = 'software';
    let mode = 'onsite';
    
    if (cached && !cached.isEstimated) {
      skills = [...(cached.matchedSkills || []), ...(cached.missingSkills || [])];
      role = cached.roleDetected || 'software';
      mode = cached.remoteStatus || 'onsite';
    } else {
      // Estimated: run light analysis
      const classify = window.classifyRoleByTitle || (typeof classifyRoleByTitle !== 'undefined' ? classifyRoleByTitle : () => 'software');
      role = classify(job.title) || 'software';
      
      const kb = window.ROLE_KNOWLEDGE_BASE || (typeof ROLE_KNOWLEDGE_BASE !== 'undefined' ? ROLE_KNOWLEDGE_BASE : { software: [] });
      skills = kb[role] ? [...kb[role]] : [];
      
      // Add explicit language from title
      const titleLower = job.title.toLowerCase();
      const languages = ['c++', 'c#', 'java', 'python', 'javascript', 'typescript', 'go', 'rust', 'ruby', 'swift', 'kotlin'];
      languages.forEach(lang => {
        if (titleLower.includes(lang) && !skills.includes(lang)) {
          skills.push(lang);
        }
      });
      
      mode = detectRemoteStatus(job.locationText + ' ' + job.title);
      if (mode === 'open') mode = 'remote'; // default open to remote for stats
    }
    
    // Normalize mode
    if (mode === 'remote') modeCount.remote++;
    else if (mode === 'hybrid') modeCount.hybrid++;
    else modeCount.onsite++;
    
    // Count role
    roleCount[role] = (roleCount[role] || 0) + 1;
    
    // Count skills (make unique per job)
    const uniqueSkills = [...new Set(skills.map(s => s.toLowerCase()))];
    uniqueSkills.forEach(s => {
      skillsCount[s] = (skillsCount[s] || 0) + 1;
    });
  });
  
  // Format Skills Demand
  const skillList = Object.entries(skillsCount).map(([skill, count]) => ({
    skill,
    count,
    pct: Math.round((count / totalJobs) * 100)
  }));
  
  // Top 10 Most Requested Skills
  const topSkills = [...skillList].sort((a, b) => b.count - a.count).slice(0, 10);
  
  // Top 10 Emerging Skills: Skills outside basic ones (filtered subset of modern tools)
  const basicSkills = ['javascript', 'html', 'css', 'git', 'sql', 'communication', 'problem-solving', 'excel', 'c++', 'java', 'python'];
  const topEmerging = [...skillList]
    .filter(item => !basicSkills.includes(item.skill))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
    
  // Personal Skill Gap Analysis
  const topRequestedAll = [...skillList].sort((a, b) => b.count - a.count);
  const youHave = topRequestedAll
    .filter(item => userSkills.includes(item.skill))
    .slice(0, 5)
    .map(item => item.skill);
    
  const missingSkillsDemand = topRequestedAll
    .filter(item => !userSkills.includes(item.skill))
    .slice(0, 6);
    
  // Learning Impact Estimator
  const avgMatchScore = Math.round(totalScoreSum / totalJobs);
  const potentialImprovements = [];
  
  if (missingSkillsDemand.length > 0) {
    let currentSimulatedProfileSkills = [...userSkills];
    const topMissing = missingSkillsDemand.slice(0, 3); // top 3 missing
    
    topMissing.forEach((item, idx) => {
      currentSimulatedProfileSkills.push(item.skill);
      
      // Recalculate score for every opening
      let totalSimulatedScoreSum = 0;
      
      detectedJobs.forEach(job => {
        const cached = jobMatchCache ? jobMatchCache.get(job.jobId) : null;
        let explicitReq = [];
        let inferredReq = [];
        
        if (cached && !cached.isEstimated) {
          explicitReq = (cached.explicitMatched || []).concat(cached.explicitMissing || []);
          inferredReq = (cached.inferredMatched || []).concat(cached.inferredMissing || []);
        } else {
          // Estimated re-evaluation
          const classify = window.classifyRoleByTitle || (typeof classifyRoleByTitle !== 'undefined' ? classifyRoleByTitle : () => 'software');
          const role = classify(job.title) || 'software';
          const kb = window.ROLE_KNOWLEDGE_BASE || (typeof ROLE_KNOWLEDGE_BASE !== 'undefined' ? ROLE_KNOWLEDGE_BASE : { software: [] });
          inferredReq = kb[role] ? [...kb[role]] : [];
          
          const titleLower = job.title.toLowerCase();
          const languages = ['c++', 'c#', 'java', 'python', 'javascript', 'typescript', 'go', 'rust', 'ruby', 'swift', 'kotlin'];
          languages.forEach(lang => {
            if (titleLower.includes(lang) && !inferredReq.includes(lang)) {
              inferredReq.push(lang);
            }
          });
        }
        
        // Recompute skill score
        let newSkillScore = 0;
        const expMatchedNew = explicitReq.filter(s => currentSimulatedProfileSkills.includes(s));
        const infMatchedNew = inferredReq.filter(s => currentSimulatedProfileSkills.includes(s));
        
        if (explicitReq.length > 0) {
          const explicitScore = Math.round((expMatchedNew.length / explicitReq.length) * 20);
          const inferredScore = inferredReq.length > 0 ? Math.round((infMatchedNew.length / inferredReq.length) * 10) : 10;
          newSkillScore = explicitScore + inferredScore;
        } else {
          newSkillScore = inferredReq.length > 0 ? Math.round((infMatchedNew.length / inferredReq.length) * 30) : 30;
        }
        
        // Retrieve non-skill scores from job breakdown
        const roleScore = job.breakdown?.role?.score || 0;
        const locScore = job.breakdown?.location?.score || 0;
        const remoteScore = job.breakdown?.remote?.score || 0;
        const expScore = job.breakdown?.experience?.score || 15;
        
        const finalScore = Math.min(100, newSkillScore + roleScore + locScore + remoteScore + expScore);
        totalSimulatedScoreSum += finalScore;
      });
      
      const simulatedAvgScore = Math.round(totalSimulatedScoreSum / totalJobs);
      potentialImprovements.push({
        skill: item.skill,
        addedCombined: topMissing.slice(0, idx + 1).map(x => x.skill.toUpperCase()).join(' + '),
        score: simulatedAvgScore
      });
    });
  }
  
  // Format Role Distribution
  const roleList = Object.entries(roleCount).map(([role, count]) => ({
    role,
    count,
    pct: Math.round((count / totalJobs) * 100)
  })).sort((a, b) => b.count - a.count);
  
  // Format Location Distribution
  const locationList = Object.entries(locationCount).map(([loc, count]) => ({
    location: loc,
    count
  })).sort((a, b) => b.count - a.count).slice(0, 5);
  
  // Opportunity Summary
  const topRole = roleList[0] ? roleList[0].role : 'Software';
  const topRolePct = roleList[0] ? roleList[0].pct : 0;
  const topSkillsSummary = topSkills.slice(0, 4).map(x => x.skill.toUpperCase()).join(', ');
  
  let summary = `Analyzed ${totalJobs} opening${totalJobs > 1 ? 's' : ''} visible on this page. ${topRole.toUpperCase()} roles dominate, representing ${topRolePct}% of the opening distribution. The highest demand skills are ${topSkillsSummary}. `;
  
  if (potentialImprovements.length > 0) {
    const bestImprovement = potentialImprovements[potentialImprovements.length - 1];
    summary += `Adding ${potentialImprovements[0].skill.toUpperCase()} could boost your average match rate to ${potentialImprovements[0].score}%. Combining ${bestImprovement.addedCombined} would elevate your average compatibility to ${bestImprovement.score}%.`;
  } else {
    summary += `Your profile currently possesses all identified high-demand skills for these openings, yielding an average match rate of ${avgMatchScore}%.`;
  }
  
  return {
    totalJobs,
    avgMatchScore,
    topSkills,
    topEmerging,
    youHave,
    missingSkills: missingSkillsDemand.map(x => ({ skill: x.skill, pct: x.pct })),
    potentialImprovements,
    roleDistribution: roleList,
    workModeDistribution: [
      { mode: 'Remote', count: modeCount.remote, pct: Math.round((modeCount.remote / totalJobs) * 100) },
      { mode: 'Hybrid', count: modeCount.hybrid, pct: Math.round((modeCount.hybrid / totalJobs) * 100) },
      { mode: 'On-site', count: modeCount.onsite, pct: Math.round((modeCount.onsite / totalJobs) * 100) }
    ],
    locations: locationList,
    matchDistribution,
    summary
  };
}

// Export functions depending on environment
const engineExports = {
  calculateEstimatedMatch,
  calculateFullMatch,
  detectRemoteStatus,
  COMMON_SKILLS,
  getSkillsList,
  normalizeSkill,
  skillMatchRegex,
  calculateMarketInsights
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = engineExports;
} else {
  // Expose on global window context for browser script injection
  window.JobCopilotMatchEngine = engineExports;
}
