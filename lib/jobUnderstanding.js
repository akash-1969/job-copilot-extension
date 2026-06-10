// JobCopilot Job Understanding Layer

(function() {
  // Helper to normalize skill names
  function normalizeSkill(skill, synonyms) {
    if (!skill) return '';
    const clean = skill.trim().toLowerCase();
    if (synonyms && synonyms[clean]) {
      return synonyms[clean].toLowerCase();
    }
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

  // Local Occupation-to-Skills Knowledge Base
  const ROLE_KNOWLEDGE_BASE = {
    backend: [
      'java', 'spring boot', 'spring', 'node.js', 'python', 'go', 'rust', 'sql', 'postgresql', 'mysql', 'mongodb', 
      'docker', 'kubernetes', 'aws', 'rest api', 'microservices', 'graphql', 'git', 'ci/cd'
    ],
    frontend: [
      'javascript', 'typescript', 'react', 'angular', 'vue', 'next.js', 'html', 'css', 'tailwind css', 'bootstrap', 
      'sass', 'redux', 'webpack', 'vite', 'graphql', 'rest api', 'git'
    ],
    fullstack: [
      'javascript', 'typescript', 'react', 'node.js', 'html', 'css', 'sql', 'postgresql', 'mysql', 'mongodb', 
      'git', 'rest api', 'docker', 'aws'
    ],
    devops: [
      'linux', 'unix', 'docker', 'kubernetes', 'ci/cd', 'terraform', 'jenkins', 'git', 'aws', 'azure', 'gcp', 
      'bash', 'shell scripting', 'ansible', 'python', 'prometheus', 'grafana'
    ],
    'machine learning': [
      'python', 'tensorflow', 'pytorch', 'pandas', 'numpy', 'scikit-learn', 'keras', 'machine learning', 
      'deep learning', 'nlp', 'computer vision', 'sql', 'data pipelines', 'spark'
    ],
    'data engineer': [
      'python', 'sql', 'spark', 'hadoop', 'postgresql', 'data pipelines', 'etl', 'data warehousing', 'aws', 
      'gcp', 'snowflake', 'scala', 'hive', 'kafka'
    ],
    'data scientist': [
      'python', 'sql', 'machine learning', 'statistics', 'data analysis', 'pandas', 'numpy', 'scikit-learn', 
      'tableau', 'r'
    ],
    qa: [
      'automated testing', 'manual testing', 'selenium', 'cypress', 'jest', 'playwright', 'qa', 'quality assurance', 
      'test automation', 'python', 'javascript', 'java', 'git', 'jira'
    ],
    cybersecurity: [
      'cybersecurity', 'network security', 'penetration testing', 'cryptography', 'linux', 'security auditing', 
      'wireshark', 'aws', 'firewalls', 'owasp'
    ],
    'product manager': [
      'product management', 'agile', 'scrum', 'jira', 'confluence', 'roadmapping', 'wireframing', 'data analysis', 
      'product strategy'
    ],
    designer: [
      'ui/ux', 'figma', 'adobe xd', 'user research', 'wireframing', 'prototyping', 'photoshop', 'illustrator', 
      'css', 'html'
    ],
    mobile: [
      'swift', 'kotlin', 'java', 'objective-c', 'dart', 'flutter', 'react native', 'ios', 'android', 'git', 'rest api'
    ],
    software: [
      'javascript', 'python', 'java', 'c++', 'git', 'sql', 'rest api', 'docker', 'html', 'css'
    ],
    // Non-technical categories
    'operations analyst': [
      'data analysis', 'reporting', 'process improvement', 'project management', 'sql', 'excel', 'tableau', 'communication'
    ],
    'hr executive': [
      'recruiting', 'talent acquisition', 'onboarding', 'employee relations', 'hr policies', 'conflict resolution', 'hris', 'communication'
    ],
    'business development': [
      'sales', 'negotiation', 'lead generation', 'crm', 'cold calling', 'account management', 'business development', 'communication'
    ],
    'retail manager': [
      'store operations', 'customer service', 'inventory management', 'staff scheduling', 'sales', 'team leadership', 'communication'
    ],
    'customer success': [
      'customer support', 'relationship management', 'communication', 'crm', 'troubleshooting', 'client retention'
    ],
    'campus ambassador': [
      'communication', 'social media', 'event planning', 'relationship management'
    ]
  };

  // Rule-based role classifier
  function classifyRoleByTitle(title) {
    if (!title) return null;
    const t = title.toLowerCase();
    
    // Software roles
    if (t.includes('full stack') || t.includes('full-stack') || t.includes('fullstack')) {
      return 'fullstack';
    }
    if (t.includes('backend') || t.includes('back-end') || t.includes('server') || t.includes('database')) {
      return 'backend';
    }
    if (t.includes('frontend') || t.includes('front-end') || t.includes('web') || t.includes('client') || t.includes('ui developer') || t.includes('react developer')) {
      return 'frontend';
    }
    if (t.includes('devops') || t.includes('site reliability') || t.includes('sre') || t.includes('infrastructure') || t.includes('cloud engineer') || t.includes('platform engineer')) {
      return 'devops';
    }
    if (t.includes('machine learning') || t.includes('ml ') || t.includes('ml-') || t.includes('nlp') || t.includes('deep learning') || t.includes('computer vision') || t.includes('ai engineer') || t.includes('artificial intelligence')) {
      return 'machine learning';
    }
    if (t.includes('data engineer') || t.includes('big data') || t.includes('etl') || t.includes('data warehouse') || t.includes('pipelines')) {
      return 'data engineer';
    }
    if (t.includes('data scientist') || t.includes('data science') || t.includes('quantitative')) {
      return 'data scientist';
    }
    if (t.includes('qa') || t.includes('quality assurance') || t.includes('test') || t.includes('sdet') || t.includes('automation engineer')) {
      return 'qa';
    }
    if (t.includes('security') || t.includes('cyber') || t.includes('penetration') || t.includes('infosec') || t.includes('cryptography')) {
      return 'cybersecurity';
    }
    if (t.includes('product manager') || t.includes('product owner') || t.includes('pm') || t.includes('product lead')) {
      if (/\bpm\b/i.test(t) || t.includes('product manager')) {
        return 'product manager';
      }
    }
    if (t.includes('designer') || t.includes('ui/ux') || t.includes('graphic') || t.includes('illustrator') || t.includes('creative director')) {
      return 'designer';
    }
    if (t.includes('mobile') || t.includes('ios') || t.includes('android') || t.includes('swift developer') || t.includes('kotlin developer')) {
      return 'mobile';
    }
    
    // Non-technical roles
    if (t.includes('operations analyst') || t.includes('operations manager') || (t.includes('operations') && t.includes('analyst'))) {
      return 'operations analyst';
    }
    if (t.includes('hr') || t.includes('human resources') || t.includes('recruiter') || t.includes('people ops') || t.includes('people operations') || t.includes('talent acquisition')) {
      return 'hr executive';
    }
    if (t.includes('business development') || t.includes('sales') || t.includes('account executive') || t.includes('account manager') || t.includes('cold call') || t.includes('lead gen')) {
      return 'business development';
    }
    if (t.includes('customer success') || t.includes('client success') || t.includes('csm') || t.includes('customer support') || t.includes('client relations')) {
      return 'customer success';
    }
    if (t.includes('ambassador') || t.includes('campus representative') || t.includes('volunteer') || t.includes('outreach') || t.includes('student coordinator') || t.includes('student leader')) {
      return 'campus ambassador';
    }
    if (t.includes('retail manager') || t.includes('store manager') || t.includes('shop manager') || t.includes('retail operations') || t.includes('merchandising')) {
      return 'retail manager';
    }
    
    // Software generic fallback
    if (t.includes('engineer') || t.includes('developer') || t.includes('programmer') || t.includes('coder') || t.includes('software')) {
      return 'software';
    }
    
    return null;
  }

  // Helper to extract required experience years
  function extractRequiredExperience(title, description) {
    const titleLower = (title || '').toLowerCase();
    const desc = description || '';
    
    const patterns = [
      /(?:minimum of|at least|preferred|require|requires|seeking|looking for|want|need)\s*(\d+)\+?\s*years?\s+(?:of\s+)?experience/i,
      /\b(\d+)\+?\s*years?\s+experience\b/i,
      /\b(\d+)\+?\s*yrs?\s+(?:of\s+)?(?:experience|exp)\b/i
    ];
    
    let matchedYears = [];
    for (const pattern of patterns) {
      let match;
      const globalPattern = new RegExp(pattern.source, 'gi');
      while ((match = globalPattern.exec(desc)) !== null) {
        const years = parseInt(match[1], 10);
        if (!isNaN(years) && years >= 0 && years <= 20) {
          matchedYears.push(years);
        }
      }
    }
    
    if (matchedYears.length > 0) {
      const maxYears = Math.max(...matchedYears);
      return Math.min(maxYears, 10);
    }
    
    if (titleLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('sr ') || titleLower.includes('lead') || titleLower.includes('principal') || titleLower.includes('staff') || titleLower.includes('architect') || titleLower.includes('manager')) {
      return 5;
    }
    if (titleLower.includes('junior') || titleLower.includes('jr.') || titleLower.includes('jr ') || titleLower.includes('entry') || titleLower.includes('associate') || titleLower.includes('intern') || titleLower.includes('co-op')) {
      return 1;
    }
    
    return 2;
  }

  // 1. Knowledge Base Provider
  const KnowledgeBaseProvider = {
    analyze(jobDetails, options = {}) {
      const title = jobDetails.title || '';
      const description = jobDetails.description || '';
      const descLower = description.toLowerCase();
      
      // Classify role
      const roleDetected = classifyRoleByTitle(title);
      
      // Get core expected KB skills
      let kbSkills = [];
      const roleMap = window.JOB_COPILOT_ROLE_MAPPINGS || ROLE_KNOWLEDGE_BASE;
      if (roleDetected && roleMap[roleDetected]) {
        kbSkills = roleMap[roleDetected];
      } else {
        kbSkills = [];
      }
      
      // Always append language if explicitly in title
      const titleLower = title.toLowerCase();
      const languages = ['c++', 'c#', 'java', 'python', 'javascript', 'typescript', 'go', 'rust', 'ruby', 'swift', 'kotlin'];
      languages.forEach(lang => {
        if (titleLower.includes(lang) && !kbSkills.includes(lang)) {
          kbSkills = [...kbSkills, lang];
        }
      });
      
      // Extract explicit skills & synonyms
      const matchEngine = window.JobCopilotMatchEngine || {};
      const skillsList = matchEngine.getSkillsList ? matchEngine.getSkillsList() : (matchEngine.COMMON_SKILLS || []);
      const synonyms = window.JOB_COPILOT_SYNONYMS || {};
      const matchRegex = matchEngine.skillMatchRegex || ((txt, s) => new RegExp('\\b' + s + '\\b', 'i').test(txt));
      
      const rawExtractedSet = new Set();
      const extractedSet = new Set();
      
      // Scan explicit list
      skillsList.forEach(skill => {
        if (matchRegex(descLower, skill)) {
          rawExtractedSet.add(skill);
          extractedSet.add(normalizeSkill(skill, synonyms));
        }
      });
      
      // Scan synonyms list to map to normalized name
      Object.keys(synonyms).forEach(syn => {
        if (matchRegex(descLower, syn)) {
          rawExtractedSet.add(syn);
          extractedSet.add(normalizeSkill(synonyms[syn], synonyms));
        }
      });
      
      const extractedSkills = Array.from(extractedSet).filter(s => s.length > 0);
      const rawExtractedSkills = Array.from(rawExtractedSet).filter(s => s.length > 0);
      
      // Scan for responsibility-based inferred skills
      const rawInferredSet = new Set();
      const inferredSet = new Set();
      const inferredKB = window.JOB_COPILOT_INFERRED_SKILLS || {};
      
      Object.keys(inferredKB).forEach(phrase => {
        const escapedPhrase = phrase.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const phraseRegex = new RegExp('\\b' + escapedPhrase + '\\b', 'i');
        
        if (phraseRegex.test(descLower)) {
          const implied = inferredKB[phrase] || [];
          implied.forEach(skill => {
            const normalizedImplied = normalizeSkill(skill, synonyms);
            if (normalizedImplied && !extractedSet.has(normalizedImplied)) {
              rawInferredSet.add(skill + " (via responsibility: '" + phrase + "')");
              inferredSet.add(normalizedImplied);
            }
          });
        }
      });
      
      // Filter inferred role core skills (expected in role map but not explicitly found)
      kbSkills.forEach(skill => {
        const normalizedSkill = normalizeSkill(skill, synonyms);
        if (normalizedSkill && !extractedSet.has(normalizedSkill)) {
          rawInferredSet.add(skill + " (via role expectations)");
          inferredSet.add(normalizedSkill);
        }
      });
      
      const inferredSkills = Array.from(inferredSet).filter(s => s.length > 0);
      const rawInferredSkills = Array.from(rawInferredSet).filter(s => s.length > 0);
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(roleDetected, extractedSkills, description.length);
      
      const requiredExperience = extractRequiredExperience(title, description);
      
      return {
        roleDetected: roleDetected || 'unknown',
        requiredExperience: requiredExperience,
        extractedSkills: extractedSkills,
        inferredSkills: inferredSkills,
        rawExtractedSkills: rawExtractedSkills,
        rawInferredSkills: rawInferredSkills,
        confidence: confidence,
        providerUsed: 'kb'
      };
    },
    
    calculateConfidence(role, explicitSkills, descLength) {
      let base = 20;
      if (role && role !== 'software') {
        base = 60;
      } else if (role === 'software') {
        base = 40;
      }
      
      // Length modifier
      let lenModifier = -20;
      if (descLength > 1200) {
        lenModifier = 20;
      } else if (descLength > 600) {
        lenModifier = 10;
      } else if (descLength >= 250) {
        lenModifier = 0;
      }
      
      // Explicit skills boost
      const boost = Math.min(20, explicitSkills.length * 4);
      
      return Math.max(0, Math.min(100, base + lenModifier + boost));
    }
  };

  // 2. Future-Ready AI Provider (Mock Stub)
  const AIProvider = {
    analyze(jobDetails, options = {}) {
      console.log(`[JobUnderstanding] Future AI Provider called (Stub mode).`);
      
      // Fallback to Knowledge Base Provider parsing but returns LLM schema structure
      const kbResult = KnowledgeBaseProvider.analyze(jobDetails, options);
      
      const titleLower = (jobDetails.title || '').toLowerCase();
      let seniority = 'Mid-level';
      if (titleLower.includes('senior') || titleLower.includes('sr') || titleLower.includes('lead') || titleLower.includes('principal') || titleLower.includes('staff')) {
        seniority = 'Senior';
      } else if (titleLower.includes('junior') || titleLower.includes('jr') || titleLower.includes('entry') || titleLower.includes('associate')) {
        seniority = 'Junior';
      } else if (titleLower.includes('intern') || titleLower.includes('co-op')) {
        seniority = 'Intern';
      }
      
      return {
        roleDetected: kbResult.roleDetected,
        requiredExperience: kbResult.requiredExperience,
        extractedSkills: kbResult.extractedSkills,
        inferredSkills: kbResult.inferredSkills,
        rawExtractedSkills: kbResult.rawExtractedSkills,
        rawInferredSkills: kbResult.rawInferredSkills,
        responsibilities: [
          "Collaborate with team members to deliver core deliverables.",
          "Maintain standard operational guidelines and project tasks."
        ],
        seniority: seniority,
        confidence: Math.min(100, kbResult.confidence + 15), // AI raises confidence
        providerUsed: 'ai'
      };
    }
  };

  // Pluggable orchestrator layer
  const JobUnderstandingLayer = {
    activeProvider: 'kb',
    aiThreshold: 50,
    
    providers: {
      kb: KnowledgeBaseProvider,
      ai: AIProvider
    },
    
    setProvider(providerName) {
      if (this.providers[providerName]) {
        this.activeProvider = providerName;
      }
    },
    
    analyzeJob(jobDetails, options = {}) {
      // Direct call routing
      const provider = this.providers[this.activeProvider];
      let result = provider.analyze(jobDetails, options);
      
      // Evaluate AI trigger parameters
      const triggers = this.evaluateAiTriggers(result, jobDetails, options);
      
      if (triggers.shouldTrigger && this.activeProvider !== 'ai') {
        console.log(`[JobUnderstanding] AI Trigger condition met: ${triggers.reason}`);
        result.aiTriggered = true;
        result.aiTriggerReason = triggers.reason;
      } else {
        result.aiTriggered = false;
        result.aiTriggerReason = '';
      }
      
      return result;
    },
    
    evaluateAiTriggers(result, jobDetails, options) {
      if (options.forceAI) {
        return { shouldTrigger: true, reason: 'user_requested' };
      }
      if (result.confidence < this.aiThreshold) {
        return { shouldTrigger: true, reason: `low_confidence (${result.confidence}%)` };
      }
      if (!result.roleDetected || result.roleDetected === 'unknown') {
        return { shouldTrigger: true, reason: 'unknown_role' };
      }
      const totalSkills = result.extractedSkills.length + result.inferredSkills.length;
      if (totalSkills < 3) {
        return { shouldTrigger: true, reason: 'insufficient_skills_detected' };
      }
      return { shouldTrigger: false };
    }
  };

  // Async helper to call Gemini API for deep job description parsing
  async function fetchGeminiAnalysis(jobDetails, apiKey) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    
    const prompt = `You are an expert technical recruiter and job parser. Analyze the following job description and return a clean JSON object conforming strictly to the requested schema. Do not include markdown wraps like \`\`\`json.
    
Job Title: ${jobDetails.title}
Job Description:
${jobDetails.description}

Requested Schema:
{
  "roleDetected": "string (e.g. backend, frontend, fullstack, devops, qa, mobile, machine learning, designer, product manager, hr executive, business development, unknown)",
  "requiredExperience": number (years of required experience extracted, or fallback based on seniority: Senior=5, Junior=1, Mid=2),
  "extractedSkills": ["string" (skills explicitly listed in requirements)],
  "inferredSkills": ["string" (additional core skills standard for this role that are implied by the duties)]
}`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: "application/json"
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText} (${response.status})`);
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const parsed = JSON.parse(rawText);
    
    // Normalize and return standard format
    const synonyms = window.JOB_COPILOT_SYNONYMS || {};
    const normalizedExtracted = (parsed.extractedSkills || []).map(s => normalizeSkill(s, synonyms)).filter(s => s.length > 0);
    const normalizedInferred = (parsed.inferredSkills || []).map(s => normalizeSkill(s, synonyms)).filter(s => s.length > 0);

    return {
      roleDetected: parsed.roleDetected || 'unknown',
      requiredExperience: typeof parsed.requiredExperience === 'number' ? parsed.requiredExperience : 2,
      extractedSkills: normalizedExtracted,
      inferredSkills: normalizedInferred,
      rawExtractedSkills: parsed.extractedSkills || [],
      rawInferredSkills: parsed.inferredSkills || [],
      confidence: 100,
      providerUsed: 'ai',
      aiTriggered: false
    };
  }

  // Exports
  const exports = {
    JobUnderstandingLayer,
    ROLE_KNOWLEDGE_BASE,
    classifyRoleByTitle,
    fetchGeminiAnalysis
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    window.JobUnderstandingLayer = JobUnderstandingLayer;
    window.ROLE_KNOWLEDGE_BASE = ROLE_KNOWLEDGE_BASE;
    window.classifyRoleByTitle = classifyRoleByTitle;
    window.fetchGeminiAnalysis = fetchGeminiAnalysis;
  }
})();
