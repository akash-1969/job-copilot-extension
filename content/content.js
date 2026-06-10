// JobCopilot Content Script - Unified Match Engine & Autofill Assistant

// Global State
let detectedFields = [];    // Form fields for Autofill
let detectedJobs = [];      // Scraped job card listings
let activeJobDetails = null; // Scraped active job details
let userProfile = null;      // Stored candidate profile

// Knowledge Base Globals
window.JOB_COPILOT_SKILLS = [];
window.JOB_COPILOT_SYNONYMS = {};
window.JOB_COPILOT_ROLE_MAPPINGS = {};
window.JOB_COPILOT_INFERRED_SKILLS = {};
window.isKbLoaded = false;

async function loadKnowledgeBase() {
  if (window.isKbLoaded) return;
  
  try {
    const fetchJson = async (fileName) => {
      const url = chrome.runtime.getURL(fileName);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to load ${fileName}: ${res.statusText}`);
      return await res.json();
    };

    const [skills, synonyms, roleMappings, inferredSkills] = await Promise.all([
      fetchJson('lib/kb/skills.json'),
      fetchJson('lib/kb/synonyms.json'),
      fetchJson('lib/kb/roleMappings.json'),
      fetchJson('lib/kb/inferredSkills.json')
    ]);

    window.JOB_COPILOT_SKILLS = skills;
    window.JOB_COPILOT_SYNONYMS = synonyms;
    window.JOB_COPILOT_ROLE_MAPPINGS = roleMappings;
    window.JOB_COPILOT_INFERRED_SKILLS = inferredSkills;
    window.isKbLoaded = true;
    console.log('[JobCopilot KB] Successfully loaded 4 local knowledge base databases.');
  } catch (err) {
    console.error('[JobCopilot KB] Error loading knowledge base, using defaults.', err);
    window.JOB_COPILOT_SKILLS = [];
    window.JOB_COPILOT_SYNONYMS = {};
    window.JOB_COPILOT_ROLE_MAPPINGS = {};
    window.JOB_COPILOT_INFERRED_SKILLS = {};
    window.isKbLoaded = true;
  }
}

let isExpanded = false;
let activeTab = 'active';    // 'active' (details), 'list' (listings), or 'autofill' (form)
let sortBy = 'score';        // 'score', 'remote', 'location', 'date'
let widgetContainer = null;
let shadowRoot = null;
let isMatchMode = false;     // True if on LinkedIn Jobs
let showDebugInfo = false;   // Collapsible diagnostic info log

let lastRenderState = {
  isExpanded: null,
  activeTab: null,
  sortBy: null,
  activeJobId: null,
  detectedJobsHash: null,
  detectedFieldsCount: null,
  showDebugInfo: null,
  score: null,
  jobsCount: null,
  fieldsCount: null
};

const jobMatchCache = new Map(); // Cache of jobId -> fullMatchResult
let marketInsightsCache = null;
let lastMarketJobsHash = '';

// Modular Dictionary of Form Fields for Autofill
const FIELD_DEFINITIONS = {
  firstName: {
    profileKey: 'fullName',
    friendlyName: 'First Name',
    aliases: [
      'first name', 'given name', 'personal name', 'fname', 'first_name', 'first-name', 'forename',
      'job_application[first_name]', 'legalnamesection_firstname', 'legalname_firstname', 'firstname'
    ]
  },
  lastName: {
    profileKey: 'fullName',
    friendlyName: 'Last Name',
    aliases: [
      'last name', 'surname', 'family name', 'lname', 'last_name', 'last-name',
      'job_application[last_name]', 'legalnamesection_lastname', 'legalname_lastname', 'lastname'
    ]
  },
  fullName: {
    profileKey: 'fullName',
    friendlyName: 'Full Name',
    aliases: [
      'full name', 'fullname', 'name', 'candidate name', 'your name', 'complete name',
      'candidate_name', 'legalnamesection_fullname', 'legalname_fullname'
    ]
  },
  email: {
    profileKey: 'email',
    friendlyName: 'Email Address',
    aliases: [
      'email', 'e-mail', 'email address', 'email_address', 'mail',
      'job_application[email]', 'emailaddress'
    ]
  },
  phone: {
    profileKey: 'phone',
    friendlyName: 'Phone Number',
    aliases: [
      'phone', 'telephone', 'mobile', 'cell', 'phone number', 'contact number', 'phone_number',
      'cell phone', 'job_application[phone]', 'mobile_phone', 'phonenumber'
    ]
  },
  linkedin: {
    profileKey: 'linkedin',
    friendlyName: 'LinkedIn Profile',
    aliases: [
      'linkedin', 'linkedin url', 'linkedin profile', 'linkedin_url',
      'urls[linkedin]', 'social_url_linkedin', 'linkedinurl'
    ]
  },
  github: {
    profileKey: 'github',
    friendlyName: 'GitHub Profile',
    aliases: [
      'github', 'github url', 'github profile', 'github_url', 'git',
      'urls[github]', 'social_url_github', 'githuburl'
    ]
  },
  portfolio: {
    profileKey: 'portfolio',
    friendlyName: 'Portfolio/Website',
    aliases: [
      'portfolio', 'website', 'portfolio url', 'personal website', 'blog', 'portfolio_url',
      'personal_website', 'urls[portfolio]', 'social_url_portfolio', 'portfoliourl', 'website_url'
    ]
  },
  university: {
    profileKey: 'university',
    friendlyName: 'University / College',
    aliases: [
      'university', 'college', 'school', 'institution', 'education school', 'uni', 'academic institution',
      'education_school', 'education_school_name', 'school_name', 'schoolname'
    ]
  },
  degree: {
    profileKey: 'degree',
    friendlyName: 'Degree Type / Major',
    aliases: [
      'degree', 'major', 'education degree', 'degree type', 'program', 'course', 'field of study',
      'education_degree', 'education_degree_name', 'degreetype', 'major_field'
    ]
  },
  skills: {
    profileKey: 'skills',
    friendlyName: 'Skills',
    aliases: [
      'skills', 'skills list', 'core skills', 'technologies', 'proficiencies', 'key skills', 'competencies',
      'skills_list', 'skillslist'
    ]
  }
};

// Initialize when page settles
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initJobCopilot();
} else {
  window.addEventListener('DOMContentLoaded', initJobCopilot);
}

// Throttled Observer to scan page on dynamic mutations
let scanTimeout = null;
const observer = new MutationObserver(() => {
  clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => {
    runPageAnalysis();
  }, 1000);
});

// Async helper to evaluate active job and trigger Gemini fallback if needed
function evaluateActiveJob(activeDetails) {
  if (!activeDetails) return;
  activeJobDetails = activeDetails;
  let cached = jobMatchCache.get(activeDetails.jobId);
  
  if (!cached || cached.isEstimated || cached.descriptionLength !== activeDetails.description.length) {
    const fullMatch = window.JobCopilotMatchEngine.calculateFullMatch(activeDetails, userProfile);
    fullMatch.isEstimated = false;
    fullMatch.jobId = activeDetails.jobId;
    fullMatch.title = activeDetails.title;
    fullMatch.company = activeDetails.company;
    fullMatch.locationText = activeDetails.locationText;
    fullMatch.descriptionLength = activeDetails.description.length;
    
    jobMatchCache.set(activeDetails.jobId, fullMatch);
    cached = fullMatch;
  }
  
  // Trigger Gemini AI Fallback only if confidence is low, API key is available, description is valid, and AI isn't already running/completed
  const hasDesc = activeDetails.description && activeDetails.description.length > 200;
  if (cached && cached.aiTriggered && userProfile.geminiApiKey && hasDesc && !cached.aiRunning && !cached.aiCompleted) {
    cached.aiRunning = true;
    console.log(`[JobCopilot AI] Low-confidence match detected (Score: ${cached.score}%, Confidence: ${cached.confidence}%). Requesting Gemini API parsing...`);
    
    // Temporarily trigger AI loading spinner in UI
    activeJobDetails = {
      ...activeDetails,
      isAiLoading: true
    };
    renderWidget();
    
    window.fetchGeminiAnalysis(activeDetails, userProfile.geminiApiKey)
      .then(aiAnalysis => {
        console.log(`[JobCopilot AI] Gemini response successfully retrieved. Re-matching...`);
        const aiMatch = window.JobCopilotMatchEngine.calculateFullMatch(activeDetails, userProfile, aiAnalysis);
        aiMatch.isEstimated = false;
        aiMatch.jobId = activeDetails.jobId;
        aiMatch.title = activeDetails.title;
        aiMatch.company = activeDetails.company;
        aiMatch.locationText = activeDetails.locationText;
        aiMatch.descriptionLength = activeDetails.description.length;
        aiMatch.aiCompleted = true;
        aiMatch.aiRunning = false;
        
        jobMatchCache.set(activeDetails.jobId, aiMatch);
        
        // Re-render UI with new match
        if (activeJobDetails && activeJobDetails.jobId === activeDetails.jobId) {
          activeJobDetails = activeDetails;
          renderWidget();
        }
      })
      .catch(err => {
        console.error(`[JobCopilot AI] Gemini parsing failed. Using rule-based fallback.`, err);
        cached.aiRunning = false;
        cached.aiCompleted = true;
        cached.aiFailed = true;
        cached.aiFailureReason = err.message;
        
        // Restore active state and render failure warning
        if (activeJobDetails && activeJobDetails.jobId === activeDetails.jobId) {
          activeJobDetails = activeDetails;
          renderWidget();
        }
      });
  }
}

// Run Init
async function initJobCopilot() {
  userProfile = await getStoredProfile();
  if (!userProfile) {
    console.log("JobCopilot: No candidate profile found in storage. Match/autofill widgets disabled.");
    return;
  }

  // Load the local knowledge base databases
  await loadKnowledgeBase();

  // Sync AI fallback threshold with understanding layer
  if (window.JobUnderstandingLayer) {
    window.JobUnderstandingLayer.aiThreshold = userProfile.aiThreshold !== undefined ? userProfile.aiThreshold : 50;
  }

  // Detect if matching applies (Multi-site check)
  const activeAdapter = window.SiteAdapter ? window.SiteAdapter.getAdapter() : null;
  isMatchMode = !!activeAdapter;
  
  if (isMatchMode) {
    activeTab = 'active';
  } else {
    activeTab = 'autofill';
  }

  // Inject temporary diagnostic red banner on supported job sites
  if (isMatchMode) {
    const banner = document.createElement('div');
    banner.id = 'jc-diagnostic-banner';
    banner.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; background: #ef4444; color: white; text-align: center; font-weight: bold; font-size: 13px; z-index: 2147483647; padding: 10px; border-bottom: 2px solid #b91c1c; font-family: sans-serif; letter-spacing: 0.05em;';
    banner.innerText = `JOBCOPILOT ACTIVE (${window.location.hostname})`;
    document.body.appendChild(banner);
    document.body.style.marginTop = '38px';
  }

  runPageAnalysis();
  observer.observe(document.body, { childList: true, subtree: true });

  // Listen for click events on the page to intercept job card clicks for immediate scoring feedback
  document.addEventListener('click', (e) => {
    // Skip if click is inside our widget container
    if (widgetContainer && (widgetContainer === e.target || widgetContainer.contains(e.target))) {
      return;
    }

    // Intercept redirects on Unstop
    const isUnstop = window.location.hostname.toLowerCase().includes('unstop.com');
    if (isUnstop) {
      const card = e.target.closest('app-opportunity-card, .opportunity_card, .opportunity-card, [class*="opportunity-card"], [class*="opportunity_card"]');
      if (card) {
        // Find corresponding job in detectedJobs
        const job = detectedJobs.find(j => j.element === card || card.contains(j.element) || (j.element && j.element.contains(card)));
        if (job) {
          e.preventDefault();
          e.stopPropagation();
          
          // Clean up previous active card style
          const prevActive = document.querySelector('[data-jc-active="true"]');
          if (prevActive) {
            prevActive.removeAttribute('data-jc-active');
            prevActive.style.outline = '';
            prevActive.style.boxShadow = '';
          }
          // Highlight current card
          card.setAttribute('data-jc-active', 'true');
          card.style.outline = '2px solid #0d9488';
          card.style.boxShadow = '0 0 12px rgba(13, 148, 136, 0.3)';
          
          activeJobDetails = {
            jobId: job.jobId,
            title: job.title,
            company: job.company,
            locationText: job.locationText,
            description: '',
            isEstimatedPreview: true,
            opportunityUrl: job.opportunityUrl || `https://unstop.com/opportunities/${job.jobId}`
          };
          
          evaluateActiveJob(activeJobDetails);
          
          activeTab = 'active';
          isExpanded = true;
          renderWidget();
          return;
        }
      }
    }

    const card = e.target.closest('li[data-occludable-job-id], .jobs-search-results-list__list-item, .job-card-container, .job_seen_beacon, td.resultContent, .slider_container');
    if (card) {
      triggerAnalysisWithRetry();
    }
  }, true); // Use capture phase to intercept card clicks and prevent default navigation on Unstop
}

// Relaxed title matching helper to handle ellipsis truncation and formatting variations
function isTitleMatch(cardTitle, detailsTitle) {
  if (!cardTitle || !detailsTitle) return false;
  
  const cleanCard = cardTitle.toLowerCase().replace(/[\s\.\…]+/g, ' ').trim();
  const cleanDetails = detailsTitle.toLowerCase().replace(/[\s\.\…]+/g, ' ').trim();
  
  if (cleanCard === cleanDetails) return true;
  
  // Handle truncation (card title is often truncated)
  const cardNoTrailing = cleanCard.replace(/[\s\.\…]+$/, '').trim();
  if (cardNoTrailing.length > 5 && cleanDetails.startsWith(cardNoTrailing)) {
    return true;
  }
  
  const detailsNoTrailing = cleanDetails.replace(/[\s\.\…]+$/, '').trim();
  if (detailsNoTrailing.length > 5 && cleanCard.startsWith(detailsNoTrailing)) {
    return true;
  }
  
  // Substring matching
  if (cardNoTrailing.length > 10 && cleanDetails.includes(cardNoTrailing)) {
    return true;
  }
  if (detailsNoTrailing.length > 10 && cleanCard.includes(detailsNoTrailing)) {
    return true;
  }

  // Token overlap overlap check (at least 75%)
  const stopWords = new Set(['engineer', 'developer', 'intern', 'co-op', 'specialist', 'associate', 'senior', 'junior', 'lead', 'staff', 'principal', 'in', 'of', 'and', 'for', 'at']);
  const cardWords = cleanCard.split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
  const detailsWords = cleanDetails.split(/\s+/).filter(w => w.length > 1 && !stopWords.has(w));
  
  if (cardWords.length > 0 && detailsWords.length > 0) {
    const intersection = cardWords.filter(w => detailsWords.includes(w));
    const ratio = intersection.length / Math.min(cardWords.length, detailsWords.length);
    if (ratio >= 0.75) return true;
  }

  return false;
}

// Polling analysis helper to sync async DOM description loads
let retryCount = 0;
let retryTimeout = null;

function triggerAnalysisWithRetry() {
  clearTimeout(retryTimeout);
  retryCount = 0;
  pollAnalysis();
}

function pollAnalysis() {
  runPageAnalysis();
  
  const activeAdapter = window.SiteAdapter ? window.SiteAdapter.getAdapter() : null;
  if (activeAdapter) {
    const activeDetails = activeAdapter.scrapeActiveJobDetails ? activeAdapter.scrapeActiveJobDetails() : null;
    const activeCardTitle = activeAdapter.scrapeActiveCardTitle ? activeAdapter.scrapeActiveCardTitle() : '';
    
    // We retry if active card is detected but active details are either missing or do not match the card title yet
    if (activeCardTitle) {
      const isMismatch = !activeDetails || !isTitleMatch(activeCardTitle, activeDetails.title);
      if (isMismatch) {
        if (retryCount < 15) { // 15 retries = 2.25s max
          retryCount++;
          retryTimeout = setTimeout(pollAnalysis, 150);
        }
      }
    }
  }
}

// Fetch stored profile from local storage
function getStoredProfile() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('profile', (result) => {
        if (result.profile && (result.profile.fullName || result.profile.email)) {
          resolve(result.profile);
        } else {
          resolve(null);
        }
      });
    } else {
      resolve(null);
    }
  });
}

// Core page scanning and match computing logic
function runPageAnalysis() {
  if (!window.isKbLoaded) {
    console.log('[JobCopilot] runPageAnalysis skipped: Knowledge Base is still loading.');
    return;
  }

  // 1. Scan for form fields regardless of domain (critical for Easy Apply modals / standard forms)
  detectedFields = scanFormFields();

  // Dynamically recalculate match mode
  const activeAdapter = window.SiteAdapter ? window.SiteAdapter.getAdapter() : null;
  isMatchMode = !!activeAdapter;

  // Print diagnostic log
  if (activeAdapter) {
    const pageType = activeAdapter.detectPageType ? activeAdapter.detectPageType() : 'details';
    const cardsCount = activeAdapter.scrapeVisibleCardJobs ? activeAdapter.scrapeVisibleCardJobs().length : 0;
    const activeDetails = activeAdapter.scrapeActiveJobDetails ? activeAdapter.scrapeActiveJobDetails() : null;
    console.log(`[JobCopilot Diagnostic] URL: ${window.location.href}`);
    console.log(`[JobCopilot Diagnostic] Adapter active: true`);
    console.log(`[JobCopilot Diagnostic] Page type detected: ${pageType}`);
    console.log(`[JobCopilot Diagnostic] Job cards found: ${cardsCount}`);
    console.log(`[JobCopilot Diagnostic] Active description pane found: ${!!activeDetails}`);
  }

  if (isMatchMode && activeAdapter) {
    // 2. Scrape visible card list
    const scrapedCards = activeAdapter.scrapeVisibleCardJobs ? activeAdapter.scrapeVisibleCardJobs() : [];
    
    // 3. Scrape active detail view
    const isUnstop = window.location.hostname.toLowerCase().includes('unstop.com');
    const showingPreview = activeJobDetails && activeJobDetails.isEstimatedPreview;

    let activeDetails = null;
    let activeCardTitle = '';

    if (!isUnstop || !showingPreview) {
      activeDetails = activeAdapter.scrapeActiveJobDetails ? activeAdapter.scrapeActiveJobDetails() : null;
      activeCardTitle = activeAdapter.scrapeActiveCardTitle ? activeAdapter.scrapeActiveCardTitle() : '';
    }
    
    // Check if the scraped details match the active card's title (using robust relaxed helper)
    const detailsAreOutdated = activeDetails && activeCardTitle && !isTitleMatch(activeCardTitle, activeDetails.title);

    // Process active job matching
    if (activeDetails && !detailsAreOutdated) {
      evaluateActiveJob(activeDetails);
    } else if (detailsAreOutdated || (activeCardTitle && !activeDetails)) {
      // Set loading state placeholder to prevent showing outdated details
      activeJobDetails = {
        isLoading: true,
        title: activeCardTitle || 'Loading...',
        company: 'Please wait...',
        locationText: '',
        description: ''
      };
    }

    // Process visible cards matching
    detectedJobs = scrapedCards.map(card => {
      const cached = jobMatchCache.get(card.jobId);
      
      if (cached) {
        cached.element = card.element; // Save active element reference
        // Apply full score to page badge
        if (activeAdapter.injectCardBadge) {
          activeAdapter.injectCardBadge(card.element, cached.score, cached.isEstimated);
        }
        return cached;
      } else {
        // Calculate estimated score for listing view
        const estMatch = window.JobCopilotMatchEngine.calculateEstimatedMatch(card, userProfile);
        estMatch.isEstimated = true;
        estMatch.jobId = card.jobId;
        estMatch.title = card.title;
        estMatch.company = card.company;
        estMatch.locationText = card.locationText;
        estMatch.element = card.element;
        
        if (activeAdapter.injectCardBadge) {
          activeAdapter.injectCardBadge(card.element, estMatch.score, true);
        }
        return estMatch;
      }
    });

    // Remove duplicates from list
    const uniqueMap = new Map();
    detectedJobs.forEach(job => uniqueMap.set(job.jobId, job));
    detectedJobs = Array.from(uniqueMap.values());

    // Sort detected job list
    sortJobList();
  }

  // Draw HUD widget
  if (isMatchMode || detectedFields.length > 0) {
    renderWidget();
  } else {
    removeWidget();
  }
}

// Convert relative LinkedIn posted date into numeric hours for sorting
function parsePostedHours(text) {
  if (!text) return 9999;
  const lower = text.toLowerCase();
  const match = lower.match(/(\d+)\s+(hour|day|week|month|minute)/);
  if (!match) return 9999;
  
  const val = parseInt(match[1], 10);
  const scale = match[2];
  
  if (scale.startsWith('minute')) return val / 60;
  if (scale.startsWith('hour')) return val;
  if (scale.startsWith('day')) return val * 24;
  if (scale.startsWith('week')) return val * 168;
  if (scale.startsWith('month')) return val * 720;
  return 9999;
}

// Sort job listings inside the sidebar
function sortJobList() {
  if (sortBy === 'score') {
    detectedJobs.sort((a, b) => b.score - a.score);
  } else if (sortBy === 'remote') {
    detectedJobs.sort((a, b) => {
      const aRemote = (a.remoteStatus === 'remote' || (a.locationText || '').toLowerCase().includes('remote')) ? 1 : 0;
      const bRemote = (b.remoteStatus === 'remote' || (b.locationText || '').toLowerCase().includes('remote')) ? 1 : 0;
      
      if (aRemote !== bRemote) return bRemote - aRemote;
      return b.score - a.score;
    });
  } else if (sortBy === 'location') {
    detectedJobs.sort((a, b) => {
      const pref = (userProfile.preferredLocation || '').toLowerCase();
      const aLoc = (a.locationText || '').toLowerCase().includes(pref) ? 1 : 0;
      const bLoc = (b.locationText || '').toLowerCase().includes(pref) ? 1 : 0;
      
      if (aLoc !== bLoc) return bLoc - aLoc;
      return b.score - a.score;
    });
  } else if (sortBy === 'date') {
    detectedJobs.sort((a, b) => {
      // Look for relative time in locationText (common on LinkedIn job cards)
      const aHrs = parsePostedHours(a.locationText);
      const bHrs = parsePostedHours(b.locationText);
      return aHrs - bHrs;
    });
  }
}

// Scans document input elements for matching profiles keys
function scanFormFields() {
  const fields = [];
  const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea, select';
  const inputs = document.querySelectorAll(selector);

  inputs.forEach(input => {
    if (input.offsetWidth === 0 && input.offsetHeight === 0) return;
    if (input.disabled || input.readOnly) return;

    let bestMatch = null;
    let highestScore = 0;
    let bestSource = '';

    const id = (input.id || '').toLowerCase();
    const name = (input.getAttribute('name') || '').toLowerCase();
    const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
    const labelText = findLabelText(input).toLowerCase();
    const dataAutomationId = (input.getAttribute('data-automation-id') || '').toLowerCase();

    const elementName = name || id || placeholder || ariaLabel || dataAutomationId || labelText || 'unnamed-input';

    for (const [key, def] of Object.entries(FIELD_DEFINITIONS)) {
      if (key === 'fullName') {
        const hasExclusion = /\b(first|last|middle|university|college|school|company|employer|reference|referee|friend|manager|sponsor|emergency|auth)\b/i.test(labelText) ||
                             /\b(first|last|middle|university|college|school|company|employer|reference|referee|friend|manager|sponsor|emergency|auth)\b/i.test(name) ||
                             /\b(first|last|middle|university|college|school|company|employer|reference|referee|friend|manager|sponsor|emergency|auth)\b/i.test(id);
        if (hasExclusion) continue;
      }

      let tempScore = 0;
      let tempSource = '';

      def.aliases.forEach(alias => {
        if (dataAutomationId && dataAutomationId.includes(alias)) {
          tempScore += 4;
          if (!tempSource) tempSource = 'automation-id';
        }
        if (labelText.includes(alias)) {
          tempScore += 3;
          if (!tempSource) tempSource = 'label';
        }
        if (ariaLabel.includes(alias)) {
          tempScore += 3;
          if (!tempSource) tempSource = 'aria-label';
        }
        if (name && (name === alias || name.includes(alias))) {
          tempScore += 2;
          if (!tempSource) tempSource = 'name';
        }
        if (id && (id === alias || id.includes(alias))) {
          tempScore += 2;
          if (!tempSource) tempSource = 'id';
        }
        if (placeholder && placeholder.includes(alias)) {
          tempScore += 1;
          if (!tempSource) tempSource = 'placeholder';
        }
      });

      if (tempScore > highestScore) {
        highestScore = tempScore;
        bestSource = tempSource;
        bestMatch = { key, def };
      }
    }

    if (bestMatch && highestScore >= 1) {
      let confidence = 'Low';
      if (highestScore >= 4) {
        confidence = 'High';
      } else if (highestScore >= 2) {
        confidence = 'Medium';
      }

      fields.push({
        element: input,
        key: bestMatch.key,
        fieldDef: bestMatch.def,
        labelText: labelText || input.getAttribute('placeholder') || bestMatch.def.friendlyName,
        confidence: confidence,
        score: highestScore,
        matchSource: bestSource,
        elementName: elementName
      });
    }
  });

  return fields;
}

// Find label text associated with input
function findLabelText(input) {
  let labelText = '';
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) labelText = label.textContent;
  }
  if (!labelText) {
    const parentLabel = input.closest('label');
    if (parentLabel) labelText = parentLabel.textContent;
  }
  if (!labelText) {
    let prev = input.previousSibling;
    let limit = 0;
    while (prev && limit < 3) {
      if (prev.nodeType === Node.ELEMENT_NODE) {
        if (prev.tagName.toLowerCase() === 'label' || prev.textContent.trim().length > 2) {
          labelText = prev.textContent;
          break;
        }
      } else if (prev.nodeType === Node.TEXT_NODE && prev.textContent.trim().length > 2) {
        labelText = prev.textContent;
        break;
      }
      prev = prev.previousSibling;
      limit++;
    }
  }
  if (!labelText) {
    const parent = input.parentElement;
    if (parent && parent.textContent.trim().length > 2) {
      const cleanParentText = parent.textContent.replace(input.textContent, '').trim();
      if (cleanParentText.length > 2 && cleanParentText.length < 100) {
        labelText = cleanParentText.split('\n')[0];
      }
    }
  }
  return labelText.replace(/\s+/g, ' ').trim();
}

// Toggle native page select boxes to prevent z-index bleed-through
function toggleUnderlyingSelects(show) {
  const selects = document.querySelectorAll('select');
  selects.forEach(sel => {
    // Skip our own widget select boxes
    if (sel.classList.contains('jc-sort-select')) return;
    sel.style.visibility = show ? 'visible' : 'hidden';
  });
}

// Remove widget container from page DOM
function removeWidget() {
  if (widgetContainer) {
    widgetContainer.remove();
    widgetContainer = null;
    shadowRoot = null;
  }
}

function ensureStylesheet() {
  if (shadowRoot && !shadowRoot.querySelector('link[href*="content.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content/content.css');
    shadowRoot.appendChild(link);
  }
}

// Render widget DOM
function renderWidget() {
  if (!widgetContainer) {
    widgetContainer = document.createElement('div');
    widgetContainer.id = 'jc-widget-container';
    document.body.appendChild(widgetContainer);
    shadowRoot = widgetContainer.attachShadow({ mode: 'open' });
  }

  if (isExpanded) {
    renderExpandedCard();
  } else {
    renderMinimizedBadge();
  }
}

// Render Minimized Badge view - Sleek Minimalist Circle
function renderMinimizedBadge() {
  const activeJobId = activeJobDetails ? activeJobDetails.jobId : null;
  const activeMatch = activeJobDetails ? jobMatchCache.get(activeJobId) : null;
  const score = activeMatch ? activeMatch.score : null;
  const jobsCount = detectedJobs.length;
  const fieldsCount = detectedFields.length;

  const stateChanged = (
    lastRenderState.isExpanded !== isExpanded ||
    lastRenderState.activeJobId !== activeJobId ||
    lastRenderState.score !== score ||
    lastRenderState.jobsCount !== jobsCount ||
    lastRenderState.fieldsCount !== fieldsCount
  );

  if (!stateChanged && shadowRoot.querySelector('.jc-minimized-badge')) {
    return; // Skip re-render if state is unchanged
  }

  // Update last render state
  lastRenderState = {
    isExpanded,
    activeTab,
    sortBy,
    activeJobId,
    detectedJobsHash: null,
    detectedFieldsCount: null,
    showDebugInfo,
    score,
    jobsCount,
    fieldsCount
  };

  let countBadgeHtml = '';
  
  if (isMatchMode) {
    const badgeText = activeMatch ? `${activeMatch.score}%` : (detectedJobs.length > 0 ? detectedJobs.length : '');
    
    if (badgeText) {
      countBadgeHtml = `<span class="jc-minimized-badge-count">${badgeText}</span>`;
    }
  } else {
    if (detectedFields.length > 0) {
      countBadgeHtml = `<span class="jc-minimized-badge-count">${detectedFields.length}</span>`;
    }
  }

  ensureStylesheet();

  // Remove card container if rendering minimized badge
  const oldCard = shadowRoot.querySelector('.jc-card');
  if (oldCard) oldCard.remove();

  let badge = shadowRoot.querySelector('.jc-minimized-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'jc-minimized-badge';
    badge.title = 'Open JobCopilot HUD';
    shadowRoot.appendChild(badge);
  }

  badge.innerHTML = `
    <div class="jc-minimized-icon-circle">JC</div>
    ${countBadgeHtml}
  `;

  badge.addEventListener('click', () => {
    isExpanded = true;
    renderWidget();
    toggleUnderlyingSelects(false);
  });
}

function getSkillDisplay(skill) {
  if (!skill) return '';
  const clean = skill.trim().toLowerCase();
  if (clean === 'cpp') return 'C++';
  if (clean === 'nodejs') return 'Node.js';
  if (clean === 'react') return 'React';
  if (clean === 'javascript') return 'JavaScript';
  if (clean === 'typescript') return 'TypeScript';
  if (clean === 'c#') return 'C#';
  if (clean === '.net') return '.NET';
  if (clean === 'aws') return 'AWS';
  if (clean === 'gcp') return 'GCP';
  if (clean === 'html') return 'HTML';
  if (clean === 'css') return 'CSS';
  if (clean === 'sql') return 'SQL';
  if (clean === 'nosql') return 'NoSQL';
  if (clean === 'ci/cd') return 'CI/CD';
  if (clean === 'git') return 'Git';
  if (clean === 'ui/ux') return 'UI/UX';
  if (clean === 'qa') return 'QA';
  if (clean === 'jira') return 'Jira';
  
  // Title case fallback
  return clean.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function generateBulletInsights(activeMatch) {
  const matches = [];
  const missing = [];

  // 1. Check matched skills (up to 3)
  const explicitMatched = activeMatch.explicitMatched || [];
  explicitMatched.slice(0, 3).forEach(skill => {
    matches.push(`${getSkillDisplay(skill)} found`);
  });
  if (matches.length < 3) {
    const inferredMatched = activeMatch.inferredMatched || [];
    inferredMatched.slice(0, 3 - matches.length).forEach(skill => {
      matches.push(`${getSkillDisplay(skill)} found (implied)`);
    });
  }

  // 2. Check role match
  if (activeMatch.breakdown.role.score >= 20) {
    const roleName = activeMatch.roleDetected ? activeMatch.roleDetected : 'role';
    matches.push(`${roleName.charAt(0).toUpperCase() + roleName.slice(1)} role match`);
  } else {
    missing.push(`Preferred role alignment`);
  }

  // 3. Check remote preference
  if (activeMatch.breakdown.remote.score === 15) {
    matches.push(`Remote preference match`);
  } else if (activeMatch.breakdown.remote.score < 10) {
    missing.push(`Remote preference mismatch`);
  }

  // 4. Check location match
  if (activeMatch.breakdown.location.score === 15) {
    matches.push(`Location preference match`);
  } else if (activeMatch.breakdown.location.score < 10) {
    missing.push(`Location preference mismatch`);
  }

  // 4b. Check experience match
  const expScore = activeMatch.breakdown.experience ? activeMatch.breakdown.experience.score : 15;
  const requiredExp = activeMatch.requiredExperience || 0;
  const candidateExp = activeMatch.candidateExperience || 0;
  
  if (expScore === 15) {
    if (requiredExp > 0) {
      matches.push(`Experience requirement met (${candidateExp} yrs)`);
    } else {
      matches.push(`Experience preference match`);
    }
  } else {
    missing.push(`Experience gap (${requiredExp} yrs required, you have ${candidateExp} yrs)`);
  }

  // 5. Check missing skills (up to 3)
  const explicitMissing = activeMatch.explicitMissing || [];
  const skillMissingBullets = [];
  explicitMissing.slice(0, 3).forEach(skill => {
    skillMissingBullets.push(getSkillDisplay(skill));
  });
  if (skillMissingBullets.length < 3) {
    const inferredMissing = activeMatch.inferredMissing || [];
    inferredMissing.slice(0, 3 - skillMissingBullets.length).forEach(skill => {
      skillMissingBullets.push(`${getSkillDisplay(skill)} (implied)`);
    });
  }

  skillMissingBullets.forEach(s => {
    missing.push(s);
  });

  return { matches, missing };
}

function getMarketInsights() {
  const currentHash = detectedJobs.map(j => `${j.jobId}:${j.score}`).join(',');
  if (!marketInsightsCache || lastMarketJobsHash !== currentHash) {
    marketInsightsCache = window.JobCopilotMatchEngine.calculateMarketInsights(detectedJobs, userProfile, jobMatchCache);
    lastMarketJobsHash = currentHash;
  }
  return marketInsightsCache;
}

// Render Expanded HUD Dashboard view
function renderExpandedCard(force = false) {
  // Check if sort dropdown is active to avoid closing it
  const sortControl = shadowRoot ? shadowRoot.querySelector('#jc-sort-control') : null;
  const isDropdownActive = sortControl && (shadowRoot.activeElement === sortControl);
  if (isDropdownActive && !force) {
    return; // Don't interrupt user interaction unless forced
  }

  // Calculate current state values
  const activeJobId = activeJobDetails ? activeJobDetails.jobId : null;
  const detectedJobsHash = detectedJobs.map(j => `${j.jobId}:${j.score}`).join(',');
  const detectedFieldsCount = detectedFields.length;

  // Check if render state has changed
  const stateChanged = (
    lastRenderState.isExpanded !== isExpanded ||
    lastRenderState.activeTab !== activeTab ||
    lastRenderState.sortBy !== sortBy ||
    lastRenderState.activeJobId !== activeJobId ||
    lastRenderState.detectedJobsHash !== detectedJobsHash ||
    lastRenderState.detectedFieldsCount !== detectedFieldsCount ||
    lastRenderState.showDebugInfo !== showDebugInfo
  );

  if (!stateChanged && shadowRoot.querySelector('.jc-card')) {
    return; // State hasn't changed and expanded card is already rendered
  }

  // Update last render state
  lastRenderState = {
    isExpanded,
    activeTab,
    sortBy,
    activeJobId,
    detectedJobsHash,
    detectedFieldsCount,
    showDebugInfo,
    score: lastRenderState.score,
    jobsCount: lastRenderState.jobsCount,
    fieldsCount: lastRenderState.fieldsCount
  };

  // Preserve scroll position
  const tabContentEl = shadowRoot ? shadowRoot.querySelector('.jc-tab-content') : null;
  const scrollTop = tabContentEl ? tabContentEl.scrollTop : 0;
  // 1. Build tabs header html
  let tabsHtml = '';
  if (isMatchMode) {
    const activeClass = activeTab === 'active' ? 'jc-active-tab' : '';
    const insightsClass = activeTab === 'insights' ? 'jc-active-tab' : '';
    const marketClass = activeTab === 'market' ? 'jc-active-tab' : '';
    const listClass = activeTab === 'list' ? 'jc-active-tab' : '';
    
    tabsHtml = `
      <div class="jc-tabs-header">
        <button class="jc-tab-btn ${activeClass}" id="jc-tab-active">Active</button>
        <button class="jc-tab-btn ${insightsClass}" id="jc-tab-insights">Insights</button>
        <button class="jc-tab-btn ${marketClass}" id="jc-tab-market">Market</button>
        <button class="jc-tab-btn ${listClass}" id="jc-tab-list">Jobs (${detectedJobs.length})</button>
    `;
    
    if (detectedFields.length > 0) {
      const fillClass = activeTab === 'autofill' ? 'jc-active-tab' : '';
      tabsHtml += `<button class="jc-tab-btn ${fillClass}" id="jc-tab-autofill">Autofill (${detectedFields.length})</button>`;
    }
    
    tabsHtml += `</div>`;
  }

  // 2. Build body depending on active tab
  let bodyHtml = '';
  let footerHtml = '';
  
  if (activeTab === 'active' && isMatchMode) {
    // ACTIVE JOB DETAILS VIEW
    const activeMatch = activeJobDetails && !activeJobDetails.isLoading && !activeJobDetails.isAiLoading ? jobMatchCache.get(activeJobDetails.jobId) : null;
    
    if (activeJobDetails && (activeJobDetails.isLoading || activeJobDetails.isAiLoading)) {
      const loadingMsg = activeJobDetails.isAiLoading ? "Consulting Gemini AI for deep analysis..." : "Analyzing job requirements...";
      bodyHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 40px 20px; gap: 16px; color:#cbd5e1; text-align:center; min-height:220px;">
          <div class="jc-loading-spinner" style="border-color:#38bdf8 !important;"></div>
          <div style="font-size: 1.1rem; font-weight:700; color:#f1f5f9; margin-top: 10px;">${activeJobDetails.title}</div>
          <div style="font-size: 0.85rem; color:#38bdf8; font-style:italic; font-weight:600; letter-spacing:0.02em;">${loadingMsg}</div>
        </div>
      `;
    } else if (activeMatch) {
      let levelClass = 'jc-low';
      if (activeMatch.score >= 80) levelClass = 'jc-high';
      else if (activeMatch.score >= 65) levelClass = 'jc-med';
      
      const makeTag = (skill, isMatched) => {
        const cls = isMatched ? 'jc-skill-tag jc-skill-matched' : 'jc-skill-tag jc-skill-missing';
        const display = getSkillDisplay(skill);
        return `<span class="${cls}">${display}</span>`;
      };

      const explicitMatchedTags = (activeMatch.explicitMatched || activeMatch.matchedSkills || []).length > 0
        ? (activeMatch.explicitMatched || activeMatch.matchedSkills).map(s => makeTag(s, true)).join('')
        : '<span style="font-size:13px; color:#64748b; font-style:italic;">None</span>';

      const explicitMissingTags = (activeMatch.explicitMissing || activeMatch.missingSkills || []).length > 0
        ? (activeMatch.explicitMissing || activeMatch.missingSkills).map(s => makeTag(s, false)).join('')
        : '<span style="font-size:13px; color:#64748b; font-style:italic;">None</span>';

      const inferredMatchedTags = (activeMatch.inferredMatched || []).length > 0
        ? activeMatch.inferredMatched.map(s => makeTag(s, true)).join('')
        : '<span style="font-size:13px; color:#64748b; font-style:italic;">None</span>';

      const inferredMissingTags = (activeMatch.inferredMissing || []).length > 0
        ? activeMatch.inferredMissing.map(s => makeTag(s, false)).join('')
        : '<span style="font-size:13px; color:#64748b; font-style:italic;">None</span>';

      const roleStr = activeMatch.roleDetected ? activeMatch.roleDetected.toUpperCase() : 'UNKNOWN';
      const confidence = activeMatch.confidence !== undefined ? activeMatch.confidence : 100;
      const confClass = confidence >= 50 ? 'jc-confidence-high' : 'jc-confidence-low';
      const providerName = activeMatch.providerUsed === 'ai' ? 'AI' : 'Local KB';

      const metaBadgesHtml = `
        <div class="jc-hud-meta-container">
          <span class="jc-hud-meta-badge">Role: ${roleStr}</span>
          <span class="jc-hud-meta-badge ${confClass}">Confidence: ${confidence}% (${providerName})</span>
        </div>
      `;

      let aiAlertHtml = '';
      if (activeMatch.aiTriggered && userProfile.geminiApiKey && !activeMatch.aiCompleted) {
        aiAlertHtml = `
          <div class="jc-hud-ai-alert" style="background:rgba(56, 189, 248, 0.05); border-left:3px solid #38bdf8; border-color: rgba(56, 189, 248, 0.25);">
            <div class="jc-loading-spinner" style="width:14px; height:14px; border-width:2px; display:inline-block; vertical-align:middle; margin-right:6px; border-color:#38bdf8 !important;"></div>
            <strong style="color:#38bdf8;">Gemini AI:</strong> Analysing details in background...
          </div>
        `;
      } else if (activeMatch.aiFailed) {
        aiAlertHtml = `
          <div class="jc-hud-ai-alert" style="background:rgba(239, 68, 68, 0.05); border-left:3px solid #ef4444; border-color: rgba(239, 68, 68, 0.25); color:#f87171;">
            <strong style="color:#ef4444;">Gemini AI failed:</strong> ${activeMatch.aiFailureReason || "Unknown error"}. Using local fallback.
          </div>
        `;
      } else if (activeMatch.providerUsed === 'ai') {
        aiAlertHtml = `
          <div class="jc-hud-ai-alert" style="background:rgba(16, 185, 129, 0.05); border-left:3px solid #10b981; border-color: rgba(16, 185, 129, 0.25); color:#a7f3d0;">
            <strong style="color:#10b981;">Gemini AI Match Active:</strong> Successfully parsed experience and skills.
          </div>
        `;
      } else if (activeMatch.aiTriggered && !userProfile.geminiApiKey) {
        aiAlertHtml = `
          <div class="jc-hud-ai-alert">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            <div>
              <strong>AI Recommended:</strong> Low-confidence match (${confidence}%). Set up a free Gemini API key in Options for deep parsing.
            </div>
          </div>
        `;
      }

      const bullets = generateBulletInsights(activeMatch);
      const matchedBulletsHtml = bullets.matches.map(m => `<li><span class="jc-bullet-check">✓</span> ${m}</li>`).join('');
      const missingBulletsHtml = bullets.missing.map(m => `<li><span class="jc-bullet-cross">✗</span> ${m}</li>`).join('');

      let applyBtnHtml = '';
      if (activeJobDetails && activeJobDetails.isEstimatedPreview) {
        applyBtnHtml = `
          <div style="margin: 12px 0 4px 0; width: 100%; display: flex; justify-content: center;">
            <button class="jc-btn jc-btn-fill jc-apply-btn" data-url="${activeJobDetails.opportunityUrl || ''}" style="width: 100%; padding: 10px; font-weight: 700; background: linear-gradient(135deg, #0d9488, #0ea5e9); border: none; border-radius: 8px; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s ease;">
              <svg style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Apply / Go to Opportunity Page
            </button>
          </div>
        `;
      }

      bodyHtml = `
        <div class="jc-score-header">
          <div class="jc-score-circle ${levelClass}">${activeMatch.score}%</div>
          <div class="jc-score-title">${activeMatch.title}</div>
          <div class="jc-score-subtitle">${activeMatch.company}</div>
          ${metaBadgesHtml}
          ${applyBtnHtml}
        </div>
        ${aiAlertHtml}
        <div class="jc-body" style="gap:14px;">
          <!-- Experience info bar -->
          <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(30, 41, 59, 0.4); border:1px solid rgba(255,255,255,0.06); padding:8px 12px; border-radius:10px; font-size:13px; margin-top:2px;">
            <span style="color:#94a3b8; display:flex; align-items:center; gap:6px;">
              <svg style="width:14px; height:14px; color:#38bdf8;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Required Experience:
            </span>
            <strong>
              ${activeMatch.requiredExperience} yrs 
              <span style="font-weight:normal; color:#64748b; margin-left:4px; margin-right:4px;">vs</span> 
              You: ${activeMatch.candidateExperience} yrs
            </strong>
          </div>

          <!-- Bullet Insights Grid (Why this match vs Missing) -->
          <div class="jc-insights-dashboard-grid">
            <div class="jc-insights-card" style="margin-bottom:0; background:rgba(30, 41, 59, 0.2); border-left:3px solid #0d9488; padding:12px 14px;">
              <div class="jc-skills-column-header" style="border-bottom:none; margin-bottom:10px; color:#2dd4bf;">Why This Match?</div>
              <ul class="jc-bullets-list">
                ${matchedBulletsHtml || '<li style="color:#64748b; font-style:italic;">None</li>'}
              </ul>
            </div>
            <div class="jc-insights-card" style="margin-bottom:0; background:rgba(248, 113, 113, 0.02); border-left:3px solid #f87171; padding:12px 14px;">
              <div class="jc-skills-column-header" style="border-bottom:none; margin-bottom:10px; color:#f87171;">Missing</div>
              <ul class="jc-bullets-list">
                ${missingBulletsHtml || '<li style="color:#64748b; font-style:italic;">None</li>'}
              </ul>
            </div>
          </div>

          <!-- Explicit Skills Dashboard Grid -->
          <div class="jc-skills-dashboard-grid">
            <div class="jc-skills-column">
              <div class="jc-skills-column-header">Matched Skills</div>
              <div class="jc-skills-group">${explicitMatchedTags}</div>
            </div>
            <div class="jc-skills-column">
              <div class="jc-skills-column-header">Missing Skills</div>
              <div class="jc-skills-group">${explicitMissingTags}</div>
            </div>
          </div>
          
          <!-- Collapsible Inferred Requirements -->
          <details class="jc-collapsible-section">
            <summary class="jc-collapsible-summary">Inferred Requirements</summary>
            <div class="jc-skills-dashboard-grid" style="margin-top: 10px; margin-bottom: 4px; border:none; padding:0; background:transparent;">
              <div class="jc-skills-column">
                <div class="jc-skills-column-header">Matched</div>
                <div class="jc-skills-group">${inferredMatchedTags}</div>
              </div>
              <div class="jc-skills-column">
                <div class="jc-skills-column-header">Missing</div>
                <div class="jc-skills-group">${inferredMissingTags}</div>
              </div>
            </div>
          </details>
          
          <!-- Collapsible Match Breakdown -->
          <details class="jc-collapsible-section">
            <summary class="jc-collapsible-summary">Detailed Match Breakdown</summary>
            <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px;">
              <div class="jc-breakdown-row" style="margin-bottom:0; padding:6px 10px; font-size:13px;">
                <span>Skill Match (30 pts)</span>
                <strong>${activeMatch.breakdown.skills.score} / 30 (${activeMatch.breakdown.skills.pct}%)</strong>
              </div>
              <div class="jc-breakdown-row" style="margin-bottom:0; padding:6px 10px; font-size:13px;">
                <span>Experience Match (15 pts)</span>
                <strong>${activeMatch.breakdown.experience ? activeMatch.breakdown.experience.score : 0} / 15 (${activeMatch.breakdown.experience ? activeMatch.breakdown.experience.pct : 0}%)</strong>
              </div>
              <div class="jc-breakdown-row" style="margin-bottom:0; padding:6px 10px; font-size:13px;">
                <span>Role Match (25 pts)</span>
                <strong>${activeMatch.breakdown.role.score} / 25 (${activeMatch.breakdown.role.pct}%)</strong>
              </div>
              <div class="jc-breakdown-row" style="margin-bottom:0; padding:6px 10px; font-size:13px;">
                <span>Location Match (15 pts)</span>
                <strong>${activeMatch.breakdown.location.score} / 15 (${activeMatch.breakdown.location.pct}%)</strong>
              </div>
              <div class="jc-breakdown-row" style="margin-bottom:0; padding:6px 10px; font-size:13px;">
                <span>Remote Match (15 pts)</span>
                <strong>${activeMatch.breakdown.remote.score} / 15 (${activeMatch.breakdown.remote.pct}%)</strong>
              </div>
            </div>
          </details>
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="jc-body" style="padding: 30px; text-align: center; color: #94a3b8; font-size: 0.95rem;">
          No active job description detected.<br>Click a job card to analyze match score.
        </div>
      `;
    }
    
    // Footer contains Autofill shortcut if form is open
    if (detectedFields.length > 0) {
      footerHtml = `
        <div style="display:flex; gap:10px; width:100%;">
          <button class="jc-btn jc-btn-minimize" id="jc-btn-minimize-bot" style="flex:1;">Minimize</button>
          <button class="jc-btn jc-btn-fill" id="jc-btn-fill-bot" style="flex:1.8;">Autofill Form</button>
        </div>
      `;
    } else {
      footerHtml = `<button class="jc-btn jc-btn-minimize" id="jc-btn-minimize-bot">Minimize</button>`;
    }
  }
  else if (activeTab === 'insights' && isMatchMode) {
    // CAREER INSIGHTS VIEW
    const activeMatch = activeJobDetails && !activeJobDetails.isLoading ? jobMatchCache.get(activeJobDetails.jobId) : null;
    
    if (activeJobDetails && activeJobDetails.isLoading) {
      bodyHtml = `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding: 40px 20px; gap: 16px; color:#cbd5e1; text-align:center; min-height:220px;">
          <div class="jc-loading-spinner"></div>
          <div style="font-size: 1.1rem; font-weight:700; color:#f1f5f9; margin-top: 10px;">${activeJobDetails.title}</div>
          <div style="font-size: 0.85rem; color:#94a3b8; font-style:italic;">Analyzing career insights...</div>
        </div>
      `;
    } else if (activeMatch && activeMatch.careerInsights) {
      const insights = activeMatch.careerInsights;
      
      // 1. Strengths
      let strengthsHtml = '';
      if (insights.strengths && insights.strengths.length > 0) {
        const strengthTags = insights.strengths.map(item => {
          const countStr = item.count > 0 ? ` (${item.count}x)` : '';
          const isExplicit = item.type === 'explicit';
          const badgeClass = isExplicit ? 'jc-skill-tag jc-skill-matched' : 'jc-skill-tag jc-skill-matched';
          return `<span class="${badgeClass}">${item.skill.toUpperCase()}${countStr}</span>`;
        }).join('');
        strengthsHtml = `
          <div class="jc-insights-card">
            <div class="jc-insights-card-title">Matched Skills</div>
            <div class="jc-skills-group">${strengthTags}</div>
          </div>
        `;
      } else {
        strengthsHtml = `
          <div class="jc-insights-card">
            <div class="jc-insights-card-title">Matched Skills</div>
            <div style="font-size: 0.9rem; color: #94a3b8; font-style: italic;">No matching skills detected. Update your profile to see strengths.</div>
          </div>
        `;
      }
      
      // 2. Missing Skills & Career Gaps
      let gapsHtml = '';
      if (insights.missingSkills && insights.missingSkills.length > 0) {
        const gapItems = insights.missingSkills.map(item => {
          let badgeClass = 'jc-impact-optional';
          if (item.impact === 'High') badgeClass = 'jc-impact-high';
          else if (item.impact === 'Medium') badgeClass = 'jc-impact-medium';
          
          return `
            <div class="jc-gap-item">
              <div class="jc-gap-header">
                <span class="jc-gap-skill">${item.skill.toUpperCase()}</span>
                <span class="jc-impact-tag ${badgeClass}">${item.impact} Impact</span>
              </div>
              <span class="jc-gap-explain">${item.explain}</span>
            </div>
          `;
        }).join('');
        gapsHtml = `
          <div class="jc-insights-card" style="padding: 0;">
            <div class="jc-insights-card-title" style="padding: 12px 12px 6px 12px; margin-bottom: 0;">Skill Gap Analysis</div>
            <div style="display: flex; flex-direction: column;">
              ${gapItems}
            </div>
          </div>
        `;
      } else {
        gapsHtml = `
          <div class="jc-insights-card">
            <div class="jc-insights-card-title">Skill Gap Analysis</div>
            <div style="font-size: 0.9rem; color: #2dd4bf; font-weight: 600;">Perfect fit! You possess all identified and implied skills for this role.</div>
          </div>
        `;
      }
      
      // 3. Score Progression Flowchart
      let pathHtml = '';
      if (insights.potentialMatchPath && insights.potentialMatchPath.length > 0) {
        const path = insights.potentialMatchPath.slice(0, 4);
        const pathRows = path.map((item, idx) => {
          const isCurrent = idx === 0;
          const rowClass = isCurrent ? 'jc-progression-row jc-current' : 'jc-progression-row jc-improved';
          const nodeContent = isCurrent ? '•' : `${idx}`;
          const labelText = isCurrent ? 'Current Profile' : `Add <span class="jc-insights-highlight">${item.addedSkill.toUpperCase()}</span>`;
          
          return `
            <div class="${rowClass}">
              <div class="jc-progression-line"></div>
              <div class="jc-progression-node">${nodeContent}</div>
              <div class="jc-progression-content">
                <span class="jc-progression-text">${labelText}</span>
                <span class="jc-progression-score">${item.score}% Match</span>
              </div>
            </div>
          `;
        }).join('');
        
        pathHtml = `
          <div class="jc-insights-card">
            <div class="jc-insights-card-title">Progression Path</div>
            <div class="jc-progression-container">
              ${pathRows}
            </div>
          </div>
        `;
      }
      
      // 4. Resume Phrasing Suggestions
      let resumeHtml = '';
      if (insights.resumeEnhancements && insights.resumeEnhancements.length > 0) {
        const enhancements = insights.resumeEnhancements.map(item => `
          <div class="jc-enhancement-item">
            <strong>${item.skill.toUpperCase()}:</strong> ${item.text}
          </div>
        `).join('');
        
        resumeHtml = `
          <div class="jc-insights-card">
            <div class="jc-insights-card-title">Resume Phrasing Suggestions</div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${enhancements}
            </div>
          </div>
        `;
      }
      
      // 5. Missing Keywords cloud
      let keywordsHtml = '';
      if (insights.missingKeywords && insights.missingKeywords.length > 0) {
        const pills = insights.missingKeywords.map(keyword => `
          <span class="jc-keyword-pill">${keyword}</span>
        `).join('');
        
        keywordsHtml = `
          <div class="jc-insights-card">
            <div class="jc-insights-card-title">Frequent Keywords</div>
            <div class="jc-keyword-group">
              ${pills}
            </div>
          </div>
        `;
      }
      
      bodyHtml = `
        <div class="jc-body" style="gap: 12px; background: #0f172a; padding-top: 10px;">
          <div class="jc-insights-title">Career Insights: ${activeJobDetails.title}</div>
          ${strengthsHtml}
          ${gapsHtml}
          ${pathHtml}
          ${resumeHtml}
          ${keywordsHtml}
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="jc-body" style="padding: 30px; text-align: center; color: #94a3b8; font-size: 0.95rem;">
          Could not retrieve career insights for this job.
        </div>
      `;
    }
    
    footerHtml = `<button class="jc-btn jc-btn-minimize" id="jc-btn-minimize-bot">Minimize</button>`;
  }
  else if (activeTab === 'market' && isMatchMode) {
    const insights = getMarketInsights();
    
    if (!insights) {
      bodyHtml = `
        <div class="jc-body" style="padding: 30px; text-align: center; color: #94a3b8; font-size: 0.95rem;">
          No visible jobs detected on this page yet.<br>Wait for listings to load or scroll.
        </div>
      `;
    } else {
      bodyHtml = `
        <div class="jc-body" style="gap: 16px; background: #0f172a; padding-top: 10px;">
          <div class="jc-insights-title">Market Insights Dashboard</div>
          <!-- Overview Card -->
          <div class="jc-insights-card" style="border-left: 3px solid #0ea5e9; background: rgba(14, 165, 233, 0.04); margin-bottom: 16px;">
            <div class="jc-insights-card-title">Market Overview</div>
            <div style="font-size: 0.95rem; line-height: 1.6; color: #cbd5e1;">${insights.summary}</div>
          </div>
          
          <!-- Key Metrics: Roles & Work Modes -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div class="jc-insights-card" style="margin-bottom: 0;">
              <div class="jc-insights-card-title">Top Roles</div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${insights.roleDistribution.slice(0, 3).map(r => `
                  <div class="jc-market-row-item">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 4px;">
                      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${r.role}">${r.role.toUpperCase()}</span>
                      <span>${r.pct}%</span>
                    </div>
                    <div class="jc-market-progress" style="height: 4px;">
                      <div class="jc-market-progress-bar" style="width: ${r.pct}%; background: #3b82f6;"></div>
                    </div>
                  </div>
                `).join('')}
                ${insights.roleDistribution.length === 0 ? '<span style="font-size:0.85rem; color:#64748b; font-style:italic;">None detected</span>' : ''}
              </div>
            </div>
            
            <div class="jc-insights-card" style="margin-bottom: 0;">
              <div class="jc-insights-card-title">Work Modes</div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${insights.workModeDistribution.map(m => `
                  <div class="jc-market-row-item">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 4px;">
                      <span>${m.mode}</span>
                      <span>${m.pct}%</span>
                    </div>
                    <div class="jc-market-progress" style="height: 4px;">
                      <div class="jc-market-progress-bar ${m.mode === 'Remote' ? 'jc-mode-remote' : (m.mode === 'Hybrid' ? 'jc-mode-hybrid' : 'jc-mode-onsite')}" style="width: ${m.pct}%;"></div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
          
          <!-- Skills Analysis (2 Columns) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
            <div class="jc-insights-card" style="margin-bottom: 0;">
              <div class="jc-insights-card-title">Top Requested Skills</div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${insights.topSkills.slice(0, 5).map((s, idx) => `
                  <div class="jc-market-row-item">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 3px;">
                      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${s.skill}"><span class="jc-market-rank">${idx+1}.</span> ${s.skill.toUpperCase()}</span>
                      <span>${s.pct}%</span>
                    </div>
                    <div class="jc-market-progress" style="height: 4px;">
                      <div class="jc-market-progress-bar" style="width: ${s.pct}%; background: #0d9488;"></div>
                    </div>
                  </div>
                `).join('')}
                ${insights.topSkills.length === 0 ? '<span style="font-size:0.85rem; color:#64748b; font-style:italic;">None detected</span>' : ''}
              </div>
            </div>
            
            <div class="jc-insights-card" style="margin-bottom: 0;">
              <div class="jc-insights-card-title">Top Emerging Tools</div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${insights.topEmerging.slice(0, 5).map((s, idx) => `
                  <div class="jc-market-row-item">
                    <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #cbd5e1; margin-bottom: 3px;">
                      <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 120px;" title="${s.skill}"><span class="jc-market-rank">${idx+1}.</span> ${s.skill.toUpperCase()}</span>
                      <span>${s.pct}%</span>
                    </div>
                    <div class="jc-market-progress" style="height: 4px;">
                      <div class="jc-market-progress-bar" style="width: ${s.pct}%; background: #a855f7;"></div>
                    </div>
                  </div>
                `).join('')}
                ${insights.topEmerging.length === 0 ? '<span style="font-size:0.85rem; color:#64748b; font-style:italic;">None detected</span>' : ''}
              </div>
            </div>
          </div>
          
          <!-- Career Alignment Card -->
          <div class="jc-insights-card" style="margin-bottom: 16px;">
            <div class="jc-insights-card-title">Your Skill Alignment</div>
            
            <div style="font-size: 0.85rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; letter-spacing:0.02em;">You Have (In Demand)</div>
            <div class="jc-skills-group" style="padding-bottom: 12px;">
              ${insights.youHave.length > 0 
                ? insights.youHave.map(s => `<span class="jc-skill-tag jc-skill-matched" style="font-size:0.85rem; padding: 4px 10px;">${s.toUpperCase()}</span>`).join('') 
                : '<span style="font-size:0.9rem; color:#64748b; font-style:italic;">None detected</span>'}
            </div>

            <div style="font-size: 0.85rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; margin-bottom: 8px; letter-spacing:0.02em;">High Demand Skills Missing</div>
            <div class="jc-skills-group" style="padding-bottom: 4px;">
              ${insights.missingSkills.length > 0 
                ? insights.missingSkills.slice(0, 5).map(s => `<span class="jc-skill-tag jc-skill-missing" style="font-size:0.85rem; padding: 4px 10px; color:#f87171; border-color:rgba(248,113,113,0.25); background:rgba(248,113,113,0.06);">${s.skill.toUpperCase()} (${s.pct}%)</span>`).join('') 
                : '<span style="font-size:0.9rem; color:#2dd4bf; font-weight:600;">None! Your profile is fully aligned.</span>'}
            </div>
          </div>
          
          <!-- Learning Stepper Flowchart -->
          <div class="jc-insights-card" style="margin-bottom: 16px;">
            <div class="jc-insights-card-title">Learning Impact Estimator</div>
            <div style="font-size: 0.9rem; color: #94a3b8; margin-bottom: 12px; line-height: 1.4;">
              Projected average match score across all visible openings if you acquire these skills:
            </div>
            <div class="jc-progression-container">
              <div class="jc-progression-row jc-current">
                <div class="jc-progression-line"></div>
                <div class="jc-progression-node">✓</div>
                <div class="jc-progression-content">
                  <span class="jc-progression-text" style="font-size:0.9rem;">Current Profile Average</span>
                  <span class="jc-progression-score" style="font-size:0.9rem;">${insights.avgMatchScore}% Match</span>
                </div>
              </div>
              ${insights.potentialImprovements.map((item, idx) => `
                <div class="jc-progression-row jc-improved">
                  <div class="jc-progression-line"></div>
                  <div class="jc-progression-node" style="font-size:0.75rem;">+${idx+1}</div>
                  <div class="jc-progression-content">
                    <span class="jc-progression-text" style="font-size:0.9rem;">Add <span class="jc-insights-highlight">${item.skill.toUpperCase()}</span></span>
                    <span class="jc-progression-score" style="font-size:0.9rem; border-color:#3b82f6; color:#60a5fa;">${item.score}% Match</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          
          <!-- Location & Score Distribution Grid -->
          <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; margin-bottom: 8px;">
            <div class="jc-insights-card" style="margin-bottom: 0;">
              <div class="jc-insights-card-title">Match Score Distribution</div>
              <div style="display: flex; flex-direction: column; gap: 6px;">
                <div class="jc-market-row-item">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 2px;">
                    <span>90% - 100% (High)</span>
                    <span>${insights.matchDistribution.high90} job${insights.matchDistribution.high90 !== 1 ? 's' : ''}</span>
                  </div>
                  <div class="jc-market-progress" style="height: 3px;">
                    <div class="jc-market-progress-bar" style="width: ${Math.round((insights.matchDistribution.high90 / insights.totalJobs) * 100)}%; background: #2dd4bf;"></div>
                  </div>
                </div>
                <div class="jc-market-row-item">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 2px;">
                    <span>80% - 89% (Good)</span>
                    <span>${insights.matchDistribution.med80} job${insights.matchDistribution.med80 !== 1 ? 's' : ''}</span>
                  </div>
                  <div class="jc-market-progress" style="height: 3px;">
                    <div class="jc-market-progress-bar" style="width: ${Math.round((insights.matchDistribution.med80 / insights.totalJobs) * 100)}%; background: #3b82f6;"></div>
                  </div>
                </div>
                <div class="jc-market-row-item">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 2px;">
                    <span>70% - 79% (Average)</span>
                    <span>${insights.matchDistribution.avg70} job${insights.matchDistribution.avg70 !== 1 ? 's' : ''}</span>
                  </div>
                  <div class="jc-market-progress" style="height: 3px;">
                    <div class="jc-market-progress-bar" style="width: ${Math.round((insights.matchDistribution.avg70 / insights.totalJobs) * 100)}%; background: #fbbf24;"></div>
                  </div>
                </div>
                <div class="jc-market-row-item">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 2px;">
                    <span>60% - 69% (Low)</span>
                    <span>${insights.matchDistribution.low60} job${insights.matchDistribution.low60 !== 1 ? 's' : ''}</span>
                  </div>
                  <div class="jc-market-progress" style="height: 3px;">
                    <div class="jc-market-progress-bar" style="width: ${Math.round((insights.matchDistribution.low60 / insights.totalJobs) * 100)}%; background: #64748b;"></div>
                  </div>
                </div>
                <div class="jc-market-row-item">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #cbd5e1; margin-bottom: 2px;">
                    <span>Below 60% (Poor)</span>
                    <span>${insights.matchDistribution.below60} job${insights.matchDistribution.below60 !== 1 ? 's' : ''}</span>
                  </div>
                  <div class="jc-market-progress" style="height: 3px;">
                    <div class="jc-market-progress-bar" style="width: ${Math.round((insights.matchDistribution.below60 / insights.totalJobs) * 100)}%; background: #ef4444;"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="jc-insights-card" style="margin-bottom: 0; display: flex; flex-direction: column;">
              <div class="jc-insights-card-title">Top Locations</div>
              <div style="display: flex; flex-direction: column; gap: 8px; flex-grow: 1; justify-content: center;">
                ${insights.locations.slice(0, 4).map(l => `
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #cbd5e1; padding: 6px 10px; background: #0f172a; border-radius: 4px; border: 1px solid #1e293b;">
                    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 95px;" title="${l.location}">${l.location}</span>
                    <span style="font-weight: 700; color: #3b82f6;">${l.count}</span>
                  </div>
                `).join('')}
                ${insights.locations.length === 0 ? '<span style="font-size:0.85rem; color:#64748b; font-style:italic; text-align:center;">None</span>' : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }
    footerHtml = `<button class="jc-btn jc-btn-minimize" id="jc-btn-minimize-bot">Minimize</button>`;
  }
  else if (activeTab === 'list' && isMatchMode) {
    // JOBS LIST RANKING VIEW
    let listItemsHtml = '';
    
    detectedJobs.forEach(job => {
      const activeClass = (activeJobDetails && activeJobDetails.jobId === job.jobId) ? 'jc-active-item' : '';
      let badgeClass = 'jc-low';
      if (job.score >= 80) badgeClass = 'jc-high';
      else if (job.score >= 65) badgeClass = 'jc-med';
      
      const suffix = job.isEstimated ? ' (Est.)' : '';
      
      listItemsHtml += `
        <div class="jc-job-list-item ${activeClass}" data-job-id="${job.jobId}">
          <div class="jc-job-list-info">
            <span class="jc-job-list-title" title="${job.title}">${job.title}</span>
            <span class="jc-job-list-company">${job.company}</span>
            <span class="jc-job-list-meta" title="${job.locationText}">${job.locationText}</span>
          </div>
          <span class="jc-list-badge ${badgeClass}">${job.score}%${suffix}</span>
        </div>
      `;
    });

    if (detectedJobs.length === 0) {
      listItemsHtml = `
        <div style="padding: 30px; text-align: center; color: #94a3b8; font-size: 0.95rem;">
          No jobs scraped on page yet.<br>Scroll the listing pane to load jobs.
        </div>
      `;
    }

    bodyHtml = `
      <div class="jc-sort-bar">
        <span>Scraped Job Listings</span>
        <div>
          <span>Sort by: </span>
          <select class="jc-sort-select" id="jc-sort-control">
            <option value="score" ${sortBy === 'score' ? 'selected' : ''}>Match Score</option>
            <option value="remote" ${sortBy === 'remote' ? 'selected' : ''}>Remote First</option>
            <option value="location" ${sortBy === 'location' ? 'selected' : ''}>Location</option>
            <option value="date" ${sortBy === 'date' ? 'selected' : ''}>Recently Posted</option>
          </select>
        </div>
      </div>
      <div class="jc-body">
        ${listItemsHtml}
      </div>
    `;
    
    footerHtml = `<button class="jc-btn jc-btn-minimize" id="jc-btn-minimize-bot">Minimize</button>`;
  } 
  else {
    // AUTOFILL FORM FIELDS VIEW
    let fieldsHtml = '';
    
    detectedFields.forEach(field => {
      let valueToFill = '';
      if (field.key === 'firstName' || field.key === 'lastName') {
        valueToFill = userProfile.fullName || '';
      } else {
        valueToFill = userProfile[field.fieldDef.profileKey] || '';
      }
      
      const filledText = valueToFill ? `Value: "${valueToFill.length > 25 ? valueToFill.substring(0, 22) + '...' : valueToFill}"` : 'Missing profile value';
      const indicatorClass = valueToFill ? 'jc-badge-high' : 'jc-badge-low';
      const labelShort = field.labelText.length > 30 ? field.labelText.substring(0, 27) + '...' : field.labelText;
      
      fieldsHtml += `
        <div class="jc-field-item">
          <div class="jc-field-info">
            <span class="jc-field-name">${field.fieldDef.friendlyName}</span>
            <span class="jc-field-label" title="${field.labelText}">${labelShort}</span>
            <span style="font-size: 0.8rem; color: #64748b; font-family: monospace; margin-top:2px;">${filledText}</span>
          </div>
          <span class="jc-badge ${indicatorClass}">${valueToFill ? 'Ready' : 'Empty'}</span>
        </div>
      `;
    });

    if (detectedFields.length === 0) {
      fieldsHtml = `
        <div style="padding:30px; text-align:center; color:#94a3b8; font-size:0.95rem;">
          No application fields detected on page.<br>Open an apply modal or career portal.
        </div>
      `;
    }

    bodyHtml = `
      <div style="display:flex; justify-content:space-between; font-size: 0.9rem; color: #94a3b8; background: #1e293b; padding: 8px 16px; border-bottom: 1px solid #334155; font-weight: 500;">
        <span>Application Autofill Form</span>
        <span style="color:#cbd5e1;">${detectedFields.length} fields detected</span>
      </div>
      <div class="jc-body">
        ${fieldsHtml}
      </div>
    `;
    
    footerHtml = `
      <div style="display:flex; gap:10px; width:100%;">
        <button class="jc-btn jc-btn-minimize" id="jc-btn-minimize-bot" style="flex:1;">Minimize</button>
        <button class="jc-btn jc-btn-fill" id="jc-btn-fill-bot" style="flex:1.8;">Fill Form</button>
      </div>
    `;
  }

  // 3. Render container HTML
  let debugHtml = '';
  if (showDebugInfo) {
    const activeAdapter = window.SiteAdapter ? window.SiteAdapter.getAdapter() : null;
    const cardsCount = activeAdapter && activeAdapter.scrapeVisibleCardJobs ? activeAdapter.scrapeVisibleCardJobs().length : 0;
    const activeDetails = activeAdapter && activeAdapter.scrapeActiveJobDetails ? activeAdapter.scrapeActiveJobDetails() : null;
    const pageType = activeAdapter && activeAdapter.detectPageType ? activeAdapter.detectPageType() : (activeAdapter ? 'details' : 'none');
    
    let baseDebugRows = `
      <div class="jc-debug-row"><span>URL:</span><span class="jc-debug-val" style="font-size:11px; max-width:210px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${window.location.href}">${window.location.href}</span></div>
      <div class="jc-debug-row"><span>Adapter Active:</span><span class="jc-debug-val">${!!activeAdapter}</span></div>
      <div class="jc-debug-row"><span>Page Type:</span><span class="jc-debug-val" style="text-transform:uppercase;">${pageType}</span></div>
      <div class="jc-debug-row"><span>Job Cards Found:</span><span class="jc-debug-val">${cardsCount}</span></div>
      <div class="jc-debug-row"><span>Description Pane:</span><span class="jc-debug-val">${activeDetails ? 'FOUND' : 'MISSING'}</span></div>
      <div class="jc-debug-row"><span>Match Engine Active:</span><span class="jc-debug-val">${isMatchMode}</span></div>
    `;

    let matchEngineDebugRows = '';
    const activeMatch = activeJobDetails && !activeJobDetails.isLoading ? jobMatchCache.get(activeJobDetails.jobId) : null;
    if (activeMatch && activeMatch.debug) {
      const dbg = activeMatch.debug;
      
      let reasonsHtml = '';
      if (Object.keys(dbg.missingReasons || {}).length > 0) {
        reasonsHtml = Object.entries(dbg.missingReasons).map(([s, reason]) => `
          <div style="font-size:11px; color:#f87171; border-left:2px solid #ef4444; padding-left:6px; margin-bottom:4px; line-height:1.3; text-align:left;">
            <strong>${s.toUpperCase()}:</strong> ${reason}
          </div>
        `).join('');
      } else {
        reasonsHtml = '<div style="font-size:11px; color:#64748b; font-style:italic; text-align:left;">None</div>';
      }

      matchEngineDebugRows = `
        <div style="margin-top:10px; border-top:1px solid #334155; padding-top:10px; text-align:left;">
          <div style="font-size:12px; font-weight:700; color:#38bdf8; margin-bottom:6px;">Match Engine Diagnostics</div>
          
          <div class="jc-debug-row" style="flex-direction:row; align-items:center; justify-content:space-between; margin-bottom:6px; font-size:11px; text-align:left;">
            <span style="font-weight:600; color:#94a3b8;">Required Experience:</span>
            <span class="jc-debug-val" style="color:#38bdf8;">${activeMatch.requiredExperience} yrs (You: ${activeMatch.candidateExperience} yrs)</span>
          </div>
          
          <div class="jc-debug-row" style="flex-direction:column; align-items:flex-start; gap:2px; margin-bottom:6px; font-size:11px;">
            <span style="font-weight:600; color:#94a3b8;">Raw Resume Skills:</span>
            <span class="jc-debug-val" style="word-break:break-all; white-space:normal; line-height:1.2; text-align:left; display:block;">${dbg.rawResumeSkills.join(', ') || 'None'}</span>
          </div>
          
          <div class="jc-debug-row" style="flex-direction:column; align-items:flex-start; gap:2px; margin-bottom:6px; font-size:11px;">
            <span style="font-weight:600; color:#94a3b8;">Normalized Resume Skills:</span>
            <span class="jc-debug-val" style="word-break:break-all; white-space:normal; line-height:1.2; color:#2dd4bf; text-align:left; display:block;">${dbg.normalizedResumeSkills.join(', ') || 'None'}</span>
          </div>
          
          <div class="jc-debug-row" style="flex-direction:column; align-items:flex-start; gap:2px; margin-bottom:6px; font-size:11px;">
            <span style="font-weight:600; color:#94a3b8;">Raw Job Skills (Explicit + Inferred):</span>
            <span class="jc-debug-val" style="word-break:break-all; white-space:normal; line-height:1.2; text-align:left; display:block;">${dbg.rawJobSkills.join(', ') || 'None'}</span>
          </div>
          
          <div class="jc-debug-row" style="flex-direction:column; align-items:flex-start; gap:2px; margin-bottom:6px; font-size:11px;">
            <span style="font-weight:600; color:#94a3b8;">Normalized Job Skills:</span>
            <span class="jc-debug-val" style="word-break:break-all; white-space:normal; line-height:1.2; color:#2dd4bf; text-align:left; display:block;">${dbg.normalizedJobSkills.join(', ') || 'None'}</span>
          </div>
          
          <div style="margin-top:8px;">
            <div style="font-size:11px; font-weight:600; color:#f87171; margin-bottom:4px;">Missing Skills Reasons:</div>
            ${reasonsHtml}
          </div>
        </div>
      `;
    }
    
    debugHtml = `
      <div class="jc-debug-info-panel" style="max-height:220px; overflow-y:auto; padding:10px 12px; background:#0b0f19; border-top:1px solid #1e293b; border-bottom:1px solid #1e293b;">
        ${baseDebugRows}
        ${matchEngineDebugRows}
      </div>
    `;
  }

  ensureStylesheet();

  // Remove minimized badge if rendering expanded card
  const oldBadge = shadowRoot.querySelector('.jc-minimized-badge');
  if (oldBadge) oldBadge.remove();

  let card = shadowRoot.querySelector('.jc-card');
  if (!card) {
    card = document.createElement('div');
    card.className = 'jc-card jc-visible';
    shadowRoot.appendChild(card);
  }

  card.innerHTML = `
    <div class="jc-header">
      <div class="jc-header-title">
        <div class="jc-header-logo">JC</div>
        <h4>JobCopilot HUD</h4>
      </div>
      <button class="jc-btn-close" id="jc-close-btn" title="Minimize">
        <svg viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
      </button>
    </div>
    ${tabsHtml}
    <div class="jc-tab-content">
      ${bodyHtml}
    </div>
    ${debugHtml}
    <div class="jc-footer" style="display: flex; flex-direction: column; gap: 8px;">
      ${footerHtml}
      <button id="jc-toggle-debug" style="background:transparent; border:none; color:#64748b; font-size:0.65rem; cursor:pointer; text-decoration:underline; width:100%; text-align:center; margin-top:2px;">
        ${showDebugInfo ? 'Hide Diagnostic Info' : 'Show Diagnostic Info'}
      </button>
    </div>
  `;

  // 4. Attach event listeners
  const closeBtn = shadowRoot.querySelector('#jc-close-btn');
  const minimizeBotBtn = shadowRoot.querySelector('#jc-btn-minimize-bot');
  const fillBtn = shadowRoot.querySelector('#jc-btn-fill-bot');
  const toggleDebugBtn = shadowRoot.querySelector('#jc-toggle-debug');
  const applyBtn = shadowRoot.querySelector('.jc-apply-btn');
  
  const collapse = () => {
    isExpanded = false;
    renderWidget();
    toggleUnderlyingSelects(true);
  };

  if (closeBtn) closeBtn.addEventListener('click', collapse);
  if (minimizeBotBtn) minimizeBotBtn.addEventListener('click', collapse);
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const url = applyBtn.getAttribute('data-url');
      if (url) {
        window.location.href = url;
      }
    });
  }
  
  if (fillBtn) {
    fillBtn.addEventListener('click', () => {
      fillFormFields();
      collapse();
    });
  }

  if (toggleDebugBtn) {
    toggleDebugBtn.addEventListener('click', () => {
      showDebugInfo = !showDebugInfo;
      renderExpandedCard();
    });
  }

  // Tabs selectors
  if (isMatchMode) {
    const tabActive = shadowRoot.querySelector('#jc-tab-active');
    const tabInsights = shadowRoot.querySelector('#jc-tab-insights');
    const tabMarket = shadowRoot.querySelector('#jc-tab-market');
    const tabList = shadowRoot.querySelector('#jc-tab-list');
    const tabAutofill = shadowRoot.querySelector('#jc-tab-autofill');

    if (tabActive) {
      tabActive.addEventListener('click', () => {
        activeTab = 'active';
        renderExpandedCard();
      });
    }
    if (tabInsights) {
      tabInsights.addEventListener('click', () => {
        activeTab = 'insights';
        renderExpandedCard();
      });
    }
    if (tabMarket) {
      tabMarket.addEventListener('click', () => {
        activeTab = 'market';
        renderExpandedCard();
      });
    }
    if (tabList) {
      tabList.addEventListener('click', () => {
        activeTab = 'list';
        renderExpandedCard();
      });
    }
    if (tabAutofill) {
      tabAutofill.addEventListener('click', () => {
        activeTab = 'autofill';
        renderExpandedCard();
      });
    }

    // Sort control dropdown listener
    const sortControl = shadowRoot.querySelector('#jc-sort-control');
    if (sortControl) {
      sortControl.addEventListener('change', (e) => {
        sortBy = e.target.value;
        sortJobList();
        renderExpandedCard(true);
      });
    }

    // Job List Item click listener - triggers native LinkedIn/Indeed card click
    const jobListItems = shadowRoot.querySelectorAll('.jc-job-list-item');
    jobListItems.forEach(item => {
      item.addEventListener('click', () => {
        const jobId = item.getAttribute('data-job-id');
        
        // Check for redirect platforms like Unstop
        const isUnstop = window.location.hostname.toLowerCase().includes('unstop.com');
        if (isUnstop) {
          const cachedJob = detectedJobs.find(j => j.jobId === jobId);
          if (cachedJob) {
            // Highlight the card on the page if it exists
            const cardElement = cachedJob.element;
            if (cardElement && document.body.contains(cardElement)) {
              const prevActive = document.querySelector('[data-jc-active="true"]');
              if (prevActive) {
                prevActive.removeAttribute('data-jc-active');
                prevActive.style.outline = '';
                prevActive.style.boxShadow = '';
              }
              cardElement.setAttribute('data-jc-active', 'true');
              cardElement.style.outline = '2px solid #0d9488';
              cardElement.style.boxShadow = '0 0 12px rgba(13, 148, 136, 0.3)';
              
              if (typeof cardElement.scrollIntoView === 'function') {
                cardElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
            }

            activeJobDetails = {
              jobId: jobId,
              title: cachedJob.title,
              company: cachedJob.company,
              locationText: cachedJob.locationText,
              description: '',
              isEstimatedPreview: true,
              opportunityUrl: cachedJob.opportunityUrl || `https://unstop.com/opportunities/${jobId}`
            };
            
            const match = window.JobCopilotMatchEngine.calculateFullMatch(activeJobDetails, userProfile);
            match.isEstimated = false;
            match.jobId = jobId;
            match.title = cachedJob.title;
            match.company = cachedJob.company;
            match.locationText = cachedJob.locationText;
            match.descriptionLength = 0;
            jobMatchCache.set(jobId, match);
            
            activeTab = 'active';
            renderExpandedCard();
            return;
          }
        }
        
        // 1. Try to find the element live in the page DOM using the jobId
        let liveCard = document.querySelector(`li[data-occludable-job-id="${jobId}"], [data-job-id="${jobId}"], [data-jk="${jobId}"]`);
        
        if (!liveCard) {
          // Look for links containing the jobId
          const links = document.querySelectorAll(`a[href*="/jobs/view/${jobId}"], a[href*="currentJobId=${jobId}"], a[href*="jk=${jobId}"], a[href*="vjk=${jobId}"]`);
          for (const link of links) {
            const card = link.closest('li[data-occludable-job-id], .jobs-search-results-list__list-item, .job-card-container, .job_seen_beacon, td.resultContent, .slider_container, .scaffold-layout__list-item');
            if (card) {
              liveCard = card;
              break;
            }
          }
        }
        
        // 2. Fallback to cached element from detectedJobs
        const cachedJob = detectedJobs.find(j => j.jobId === jobId);
        const cachedElement = cachedJob ? cachedJob.element : null;
        const cardToClick = liveCard || cachedElement;
        
        // 3. Check if we have a valid DOM element currently attached to the document
        if (cardToClick && document.body.contains(cardToClick)) {
          // Scroll the card into view if it's virtualized/recycled and needs to be visible
          if (typeof cardToClick.scrollIntoView === 'function') {
            cardToClick.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          
          const titleLink = cardToClick.querySelector('a, .job-card-list__title, .job-card-container__link, a.jcs-JobDetails-title') || cardToClick;
          if (titleLink) {
            titleLink.click();
            activeTab = 'active'; // automatically focus on details when clicked
            renderExpandedCard();
            triggerAnalysisWithRetry();
          }
        } else {
          // 4. SPA Navigation Fallback if element is missing or detached from DOM
          console.log(`[JobCopilot] Job card ${jobId} not in active DOM. Triggering SPA navigation fallback.`);
          const tempLink = document.createElement('a');
          const hostname = window.location.hostname.toLowerCase();
          
          if (hostname.includes('linkedin.com')) {
            tempLink.href = `/jobs/view/${jobId}/`;
          } else if (hostname.includes('indeed.com')) {
            tempLink.href = `/viewjob?jk=${jobId}`;
          } else {
            // Generic URL parameter change fallback
            const url = new URL(window.location.href);
            url.searchParams.set('jobId', jobId);
            tempLink.href = url.pathname + url.search;
          }
          
          tempLink.style.display = 'none';
          document.body.appendChild(tempLink);
          tempLink.click();
          tempLink.remove();
          
          activeTab = 'active';
          renderExpandedCard();
          triggerAnalysisWithRetry();
        }
      });
    });
  }

  // Restore scroll position
  const newTabContentEl = shadowRoot.querySelector('.jc-tab-content');
  if (newTabContentEl) {
    newTabContentEl.scrollTop = scrollTop;
  }
}

// Populate the page form inputs with stored profile data (support React/Vue DOM triggers)
function fillFormFields() {
  if (!userProfile) return;

  detectedFields.forEach(field => {
    const el = field.element;
    const key = field.key;
    
    let valueToFill = '';

    if (key === 'firstName') {
      if (userProfile.fullName) {
        valueToFill = userProfile.fullName.split(' ')[0] || '';
      }
    } else if (key === 'lastName') {
      if (userProfile.fullName) {
        const parts = userProfile.fullName.trim().split(/\s+/);
        if (parts.length > 1) {
          valueToFill = parts.slice(1).join(' ');
        }
      }
    } else {
      const profileKey = field.fieldDef.profileKey;
      valueToFill = userProfile[profileKey] || '';
    }

    if (!valueToFill) return;

    if (el.tagName.toLowerCase() === 'select') {
      let matchedValue = null;
      const lowerVal = valueToFill.toLowerCase();
      
      for (let option of el.options) {
        const text = option.text.toLowerCase();
        const val = option.value.toLowerCase();
        
        if (text.includes(lowerVal) || lowerVal.includes(text) ||
            val.includes(lowerVal) || lowerVal.includes(val)) {
          matchedValue = option.value;
          break;
        }
      }
      
      if (matchedValue !== null) {
        el.value = matchedValue;
      } else if (el.options.length > 1) {
        el.selectedIndex = 1;
      }
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      // Bypasses React DOM value interceptor
      const prototype = el.tagName.toLowerCase() === 'textarea' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
      
      if (valueSetter) {
        valueSetter.call(el, valueToFill);
      } else {
        el.value = valueToFill;
      }
      
      // Dispatch events to satisfy Angular/Vue/React virtual DOM bindings
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  });
}
