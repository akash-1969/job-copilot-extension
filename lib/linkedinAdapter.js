// JobCopilot LinkedIn Page Adapter

const LinkedInAdapter = {
  // Detect page type: 'list' (search results) or 'details' (single view page)
  detectPageType() {
    const url = window.location.href.toLowerCase();
    if (url.includes('/jobs/search') || url.includes('/jobs/collections') || document.querySelector('li[data-occludable-job-id]')) {
      return 'list';
    }
    if (url.includes('/jobs/view') && !document.querySelector('li[data-occludable-job-id]')) {
      return 'details';
    }
    // Fallback search: if there is a list of jobs, treat as list
    if (document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container').length > 1) {
      return 'list';
    }
    return null;
  },

  // Scrape all visible job cards from the left-hand listing pane
  scrapeVisibleCardJobs() {
    const jobs = [];
    const cardSelectors = [
      'li[data-occludable-job-id]',
      '.jobs-search-results-list__list-item',
      '.job-card-container',
      '.scaffold-layout__list-item'
    ];
    
    // Select elements
    let elements = [];
    for (const selector of cardSelectors) {
      const found = document.querySelectorAll(selector);
      if (found.length > 0) {
        elements = Array.from(found);
        break;
      }
    }

    elements.forEach(el => {
      // 1. Extract Job ID
      let jobId = el.getAttribute('data-occludable-job-id') || el.getAttribute('data-job-id');
      
      // Fallback: search links inside
      if (!jobId) {
        const link = el.querySelector('a[href*="/jobs/view/"]');
        if (link) {
          const match = link.href.match(/\/jobs\/view\/(\d+)/);
          if (match) {
            jobId = match[1];
          }
        }
      }

      if (!jobId) return;

      // 2. Extract Title
      const titleEl = el.querySelector('.job-card-list__title, .job-card-container__link, [class*="title"] a, h3');
      const title = titleEl ? titleEl.textContent.trim() : '';

      // 3. Extract Company
      const companyEl = el.querySelector('.job-card-container__company-name, .job-card-list__company-name, [class*="company"]');
      const company = companyEl ? companyEl.textContent.trim() : '';

      // 4. Extract Location / Workplace details
      const locationEl = el.querySelector('.job-card-container__metadata-item, .job-card-list__metadata-item, [class*="metadata"] li');
      const locationText = locationEl ? locationEl.textContent.trim() : '';

      // Clean up whitespace
      const cleanTitle = title.replace(/\s+/g, ' ').trim();
      const cleanCompany = company.replace(/\s+/g, ' ').trim();
      const cleanLoc = locationText.replace(/\s+/g, ' ').trim();

      if (cleanTitle) {
        jobs.push({
          jobId: jobId,
          title: cleanTitle,
          company: cleanCompany,
          locationText: cleanLoc,
          element: el
        });
      }
    });

    return jobs;
  },

  // Scrape full job details from the active right-hand details pane
  scrapeActiveJobDetails() {
    // 1. Detect active Job ID from URL or page context
    let jobId = null;
    const urlMatch = window.location.href.match(/\/jobs\/view\/(\d+)/);
    if (urlMatch) {
      jobId = urlMatch[1];
    } else {
      // Look for active list item
      const activeCard = document.querySelector('.jobs-search-results-list__list-item--active, [class*="active"] li[data-occludable-job-id]');
      if (activeCard) {
        jobId = activeCard.getAttribute('data-occludable-job-id');
      }
    }

    // 2. Title selector
    const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title h1, .jobs-unified-top-card__content--left h1, h2.t-24, [class*="job-title"] h1');
    const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';

    // 3. Company selector
    const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a, [class*="company-name"]');
    const company = companyEl ? companyEl.textContent.trim().replace(/\s+/g, ' ') : '';

    // 4. Location & Workplace type selector
    const locEl = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container span, .jobs-unified-top-card__bullet, [class*="primary-description"] span');
    const locationText = locEl ? locEl.textContent.trim().replace(/\s+/g, ' ') : '';

    const remoteEl = document.querySelector('.jobs-unified-top-card__workplace-type, [class*="workplace-type"]');
    const remoteStatus = remoteEl ? remoteEl.textContent.trim().replace(/\s+/g, ' ') : '';
    
    // Combine location details
    const combinedLocation = `${locationText} ${remoteStatus}`.trim();

    // 5. Job Description selector
    const descEl = document.querySelector('#job-details, .jobs-description__content, .jobs-description-content__text');
    const description = descEl ? descEl.textContent.trim() : '';

    if (!title || !description) {
      return null;
    }

    return {
      jobId: jobId || 'active',
      title: title,
      company: company,
      locationText: combinedLocation,
      description: description
    };
  },

  // Inject a visual match badge onto the specific LinkedIn job card element
  injectCardBadge(cardElement, score, isEstimated) {
    if (!cardElement) return;

    // Check if badge already exists
    let badge = cardElement.querySelector('.jc-injected-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'jc-injected-badge';
      
      // Ensure the card element has relative positioning to place the absolute badge
      const computedStyle = window.getComputedStyle(cardElement);
      if (computedStyle.position === 'static') {
        cardElement.style.position = 'relative';
      }
      
      cardElement.appendChild(badge);
    }

    // Determine color class based on score
    let colorClass = 'jc-badge-low';
    let icon = '⚠️';
    
    if (score >= 80) {
      colorClass = 'jc-badge-high';
      icon = '🔥';
    } else if (score >= 65) {
      colorClass = 'jc-badge-med';
      icon = '⚡';
    }

    // Set class list
    badge.className = `jc-injected-badge ${colorClass}`;
    
    // Set text contents
    const suffix = isEstimated ? ' Est.' : '';
    badge.innerHTML = `${icon} ${score}%${suffix}`;
  }
};

// Export based on execution environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LinkedInAdapter;
} else {
  window.LinkedInAdapter = LinkedInAdapter;
}
