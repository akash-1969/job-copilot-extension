// JobCopilot Job Understanding Layer

(function() {
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
    if (t.includes('retail manager') || t.includes('store manager') || t.includes('shop manager') || t.includes('retail operations') || t.includes('merchandising')) {
      return 'retail manager';
    }
    
    // Software generic fallback
    if (t.includes('engineer') || t.includes('developer') || t.includes('programmer') || t.includes('coder') || t.includes('software')) {
      return 'software';
    }
    
    return null;
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
      if (roleDetected && ROLE_KNOWLEDGE_BASE[roleDetected]) {
        kbSkills = ROLE_KNOWLEDGE_BASE[roleDetected];
      } else {
        kbSkills = ROLE_KNOWLEDGE_BASE['software']; // fallback
      }
      
      // Always append language if explicitly in title
      const titleLower = title.toLowerCase();
      const languages = ['c++', 'c#', 'java', 'python', 'javascript', 'typescript', 'go', 'rust', 'ruby', 'swift', 'kotlin'];
      languages.forEach(lang => {
        if (titleLower.includes(lang) && !kbSkills.includes(lang)) {
          kbSkills = [...kbSkills, lang];
        }
      });
      
      // Extract explicit skills
      const matchEngine = window.JobCopilotMatchEngine || {};
      const skillsList = matchEngine.COMMON_SKILLS || [];
      const matchRegex = matchEngine.skillMatchRegex || ((txt, s) => new RegExp('\\b' + s + '\\b', 'i').test(txt));
      
      const extractedSkills = skillsList.filter(skill => matchRegex(descLower, skill));
      
      // Filter inferred skills (expected in KB but not explicitly found)
      const inferredSkills = kbSkills.filter(skill => !extractedSkills.includes(skill));
      
      // Calculate confidence score
      const confidence = this.calculateConfidence(roleDetected, extractedSkills, description.length);
      
      return {
        roleDetected: roleDetected || 'unknown',
        extractedSkills: extractedSkills,
        inferredSkills: inferredSkills,
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
        extractedSkills: kbResult.extractedSkills,
        inferredSkills: kbResult.inferredSkills,
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

  // Exports
  const exports = {
    JobUnderstandingLayer,
    ROLE_KNOWLEDGE_BASE,
    classifyRoleByTitle
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exports;
  } else {
    window.JobUnderstandingLayer = JobUnderstandingLayer;
    window.ROLE_KNOWLEDGE_BASE = ROLE_KNOWLEDGE_BASE;
    window.classifyRoleByTitle = classifyRoleByTitle;
  }
})();
