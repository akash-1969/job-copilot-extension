// Helper to clean text by stripping hidden elements (e.g., visually-hidden screen reader helper elements)
function getCleanText(element) {
  if (!element) return '';
  const clone = element.cloneNode(true);
  const hiddenSelectors = ['.visually-hidden', '.sr-only', '[class*="visually-hidden"]', '[class*="screen-reader"]', '[style*="display: none"]', '[style*="visibility: hidden"]'];
  hiddenSelectors.forEach(sel => {
    clone.querySelectorAll(sel).forEach(el => el.remove());
  });
  return clone.textContent.replace(/\s+/g, ' ').trim();
}

const SiteAdapter = {
  // Detect active adapter based on hostname or page structure
  getAdapter() {
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    
    if (host.includes('linkedin.com') || path.includes('test_form.html')) {
      return this.LinkedIn;
    }
    if (host.includes('indeed.com')) {
      return this.Indeed;
    }
    if (host.includes('unstop.com')) {
      return this.Unstop;
    }
    
    // Check elements for embedded boards
    if (host.includes('greenhouse.io') || document.querySelector('[data-automation-id="greenhouse-job-board"]') || document.querySelector('#grnhse_app')) {
      return this.Greenhouse;
    }
    if (host.includes('lever.co') || document.querySelector('.lever-posting') || document.querySelector('.posting-header')) {
      return this.Lever;
    }
    
    // Fallback: check if the page looks like a generic job post
    if (this.Generic.detectPageType()) {
      return this.Generic;
    }
    
    return null;
  },

  // 1. LINKEDIN ADAPTER
  LinkedIn: {
    detectPageType() {
      const url = window.location.href.toLowerCase();
      if (url.includes('/jobs/search') || url.includes('/jobs/collections') || document.querySelector('li[data-occludable-job-id]')) {
        return 'list';
      }
      if (url.includes('/jobs/view') && !document.querySelector('li[data-occludable-job-id]')) {
        return 'details';
      }
      if (document.querySelectorAll('.jobs-search-results-list__list-item, .job-card-container').length > 1) {
        return 'list';
      }
      return null;
    },

    scrapeVisibleCardJobs() {
      const jobs = [];
      const cardSelectors = [
        'li[data-occludable-job-id]',
        '.jobs-search-results-list__list-item',
        '.job-card-container',
        '.scaffold-layout__list-item'
      ];
      
      let elements = [];
      for (const selector of cardSelectors) {
        const found = document.querySelectorAll(selector);
        if (found.length > 0) {
          elements = Array.from(found);
          break;
        }
      }

      elements.forEach(el => {
        // Exclude cards that are located inside the job details pane (to prevent duplicate processing/badges)
        if (el.closest('.scaffold-layout__detail, .jobs-search__job-details, #job-details, .jobs-description__content')) return;

        let jobId = el.getAttribute('data-occludable-job-id') || el.getAttribute('data-job-id');
        if (!jobId) {
          const link = el.querySelector('a[href*="/jobs/view/"]');
          if (link) {
            const match = link.href.match(/\/jobs\/view\/(\d+)/);
            if (match) jobId = match[1];
          }
        }

        if (!jobId) return;

        const titleEl = el.querySelector('.job-card-list__title, .job-card-container__link, [class*="title"] a, h3');
        const title = titleEl ? getCleanText(titleEl) : '';

        const companyEl = el.querySelector('.job-card-container__company-name, .job-card-list__company-name, [class*="company"]');
        const company = companyEl ? getCleanText(companyEl) : '';

        const locationEl = el.querySelector('.job-card-container__metadata-item, .job-card-list__metadata-item, [class*="metadata"] li');
        const locationText = locationEl ? getCleanText(locationEl) : '';

        const cleanTitle = title;
        const cleanCompany = company;
        const cleanLoc = locationText;

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

    scrapeActiveJobDetails() {
      let jobId = null;
      const urlMatch = window.location.href.match(/\/jobs\/view\/(\d+)/);
      if (urlMatch) {
        jobId = urlMatch[1];
      } else {
        // Extract from url parameters if present
        const urlParams = new URLSearchParams(window.location.search);
        jobId = urlParams.get('currentJobId');
        if (!jobId) {
          const activeCard = document.querySelector(
            'li[data-occludable-job-id][class*="active"], ' +
            'li[data-occludable-job-id][class*="selected"], ' +
            '.jobs-search-results-list__list-item--active, ' +
            '.job-card-container--active, ' +
            '[class*="active"] li[data-occludable-job-id], ' +
            '[class*="selected"] li[data-occludable-job-id]'
          );
          if (activeCard) {
            jobId = activeCard.getAttribute('data-occludable-job-id') || activeCard.getAttribute('data-job-id');
          }
        }
      }

      const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title h1, .jobs-unified-top-card__content--left h1, h2.t-24, [class*="job-title"] h1');
      const title = titleEl ? getCleanText(titleEl) : '';

      const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a, .jobs-unified-top-card__company-name a, [class*="company-name"]');
      const company = companyEl ? getCleanText(companyEl) : '';

      const locEl = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container span, .jobs-unified-top-card__bullet, [class*="primary-description"] span');
      const locationText = locEl ? getCleanText(locEl) : '';

      const remoteEl = document.querySelector('.jobs-unified-top-card__workplace-type, [class*="workplace-type"]');
      const remoteStatus = remoteEl ? getCleanText(remoteEl) : '';
      
      const combinedLocation = `${locationText} ${remoteStatus}`.trim().replace(/\s+/g, ' ');

      const descEl = document.querySelector('#job-details, .jobs-description__content, .jobs-description-content__text');
      const description = descEl ? descEl.textContent.trim() : '';

      if (!title || !description) return null;

      return {
        jobId: jobId || hashCode(title + company),
        title: title,
        company: company,
        locationText: combinedLocation,
        description: description
      };
    },

    injectCardBadge(cardElement, score, isEstimated) {
      injectBadgeGeneric(cardElement, score, isEstimated);
    },

    scrapeActiveCardTitle() {
      // Prioritize active card lookup by query parameter jobId
      const urlParams = new URLSearchParams(window.location.search);
      const curJobId = urlParams.get('currentJobId');
      if (curJobId) {
        const card = document.querySelector(`li[data-occludable-job-id="${curJobId}"], [data-job-id="${curJobId}"]`);
        if (card) {
          const titleEl = card.querySelector('.job-card-list__title, .job-card-container__link, [class*="title"] a, h3');
          if (titleEl) return getCleanText(titleEl);
        }
      }

      // Fallback
      const activeCard = document.querySelector(
        'li[data-occludable-job-id][class*="active"], ' +
        'li[data-occludable-job-id][class*="selected"], ' +
        '.jobs-search-results-list__list-item--active, ' +
        '.job-card-container--active, ' +
        '[class*="active"] li[data-occludable-job-id], ' +
        '[class*="selected"] li[data-occludable-job-id], ' +
        '[class*="active"] .job-card-container, ' +
        '[class*="selected"] .job-card-container'
      );
      if (activeCard) {
        const titleEl = activeCard.querySelector('.job-card-list__title, .job-card-container__link, [class*="title"] a, h3');
        return titleEl ? getCleanText(titleEl) : '';
      }
      return '';
    }
  },

  // 2. INDEED ADAPTER
  Indeed: {
    detectPageType() {
      const url = window.location.href.toLowerCase();
      if (url.includes('/jobs') || url.includes('/q-') || document.querySelector('.job_seen_beacon')) {
        return 'list';
      }
      if (url.includes('/viewjob') || url.includes('/rc/clk') || document.querySelector('#jobDescriptionText')) {
        return 'details';
      }
      return null;
    },

    scrapeVisibleCardJobs() {
      const jobs = [];
      
      // Select cards using a prioritized list to avoid duplicate matching (e.g. td.resultContent inside .job_seen_beacon)
      let cards = document.querySelectorAll('.job_seen_beacon');
      if (cards.length === 0) {
        cards = document.querySelectorAll('td.resultContent');
      }
      if (cards.length === 0) {
        cards = document.querySelectorAll('.slider_container');
      }
      
      cards.forEach(el => {
        // Exclude cards that are located inside the job details right-hand pane
        if (el.closest('#jobsearch-ViewjobPaneWrapper, #vjs-container, .jobsearch-RightPane')) return;

        // Find Job ID from a link with data-jk attribute or class
        let jobId = el.getAttribute('data-jk');
        const link = el.querySelector('a[data-jk], a[href*="jk="]');
        if (!jobId && link) {
          jobId = link.getAttribute('data-jk');
          if (!jobId) {
            const urlMatch = link.href.match(/jk=([a-fA-F0-9]+)/);
            if (urlMatch) jobId = urlMatch[1];
          }
        }
        
        if (!jobId) return;

        const titleEl = el.querySelector('h2.jobTitle, a.jcs-JobDetails-title, span[id^="jobTitle"]');
        const title = titleEl ? getCleanText(titleEl) : '';

        const companyEl = el.querySelector('span[data-testid="company-name"], .companyName, .company_location .companyName');
        const company = companyEl ? getCleanText(companyEl) : '';

        const locationEl = el.querySelector('div[data-testid="text-location"], .companyLocation, .company_location .companyLocation');
        const locationText = locationEl ? getCleanText(locationEl) : '';

        const cleanTitle = title;
        const cleanCompany = company;
        const cleanLoc = locationText;

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

    scrapeActiveJobDetails() {
      // Find active job ID
      let jobId = null;
      const params = new URLSearchParams(window.location.search);
      jobId = params.get('jk') || params.get('vjk');
      
      if (!jobId) {
        const urlMatch = window.location.href.match(/[?&]jk=([a-fA-F0-9]+)/) || window.location.href.match(/[?&]vjk=([a-fA-F0-9]+)/);
        if (urlMatch) jobId = urlMatch[1];
      }
      
      if (!jobId) {
        const urlMatch = window.location.href.match(/\/viewjob\/([a-fA-F0-9]+)/);
        if (urlMatch) jobId = urlMatch[1];
      }

      // Check split pane active item
      if (!jobId) {
        const activeItem = document.querySelector(
          '.job_seen_beacon[class*="active"], ' +
          '.job_seen_beacon[class*="selected"], ' +
          '[class*="active"] .job_seen_beacon, ' +
          '[class*="selected"] .job_seen_beacon'
        );
        if (activeItem) {
          jobId = activeItem.getAttribute('data-jk');
        }
      }

      // 2. Title selector
      const titleEl = document.querySelector('.jobsearch-JobInfoHeader-title-container h1, h1.jobsearch-JobInfoHeader-title, .jobsearch-JobInfoHeader-title');
      const title = titleEl ? getCleanText(titleEl) : '';

      // 3. Company selector
      const companyEl = document.querySelector('div[data-testid="inline-header-company-name"] a, .jobsearch-CompanyInfoContainer a, [class*="jobsearch-InlineCompanyRating"]');
      const company = companyEl ? getCleanText(companyEl) : '';

      // 4. Location selector
      const locEl = document.querySelector('div[data-testid="inline-header-company-name"] + div, .jobsearch-JobInfoContainer > div:nth-child(2), [class*="jobsearch-JobInfoHeader-subtitle"]');
      const locationText = locEl ? getCleanText(locEl) : '';

      // 5. Description selector
      const descEl = document.querySelector('#jobDescriptionText, .jobsearch-jobDescriptionText');
      const description = descEl ? descEl.textContent.trim() : '';

      if (!title || !description) return null;

      return {
        jobId: jobId || hashCode(title + company),
        title: title,
        company: company,
        locationText: locationText,
        description: description
      };
    },

    injectCardBadge(cardElement, score, isEstimated) {
      injectBadgeGeneric(cardElement, score, isEstimated);
    },

    scrapeActiveCardTitle() {
      // Find active job ID
      const params = new URLSearchParams(window.location.search);
      const jobId = params.get('jk') || params.get('vjk');
      
      if (jobId) {
        const activeCard = document.querySelector(`.job_seen_beacon[data-jk="${jobId}"], [data-jk="${jobId}"], a[href*="jk=${jobId}"], a[href*="vjk=${jobId}"]`);
        if (activeCard) {
          const titleEl = activeCard.querySelector('h2.jobTitle, a.jcs-JobDetails-title, span[id^="jobTitle"]');
          if (titleEl) return getCleanText(titleEl);
        }
      }

      // Fallback
      const activeCard = document.querySelector(
        '.job_seen_beacon[class*="active"], ' +
        '.job_seen_beacon[class*="selected"], ' +
        '.tapItem[class*="active"], ' +
        '.tapItem[class*="selected"], ' +
        '[class*="active"] .job_seen_beacon, ' +
        '[class*="selected"] .job_seen_beacon'
      );
      if (activeCard) {
        const titleEl = activeCard.querySelector('h2.jobTitle, a.jcs-JobDetails-title, span[id^="jobTitle"]');
        return titleEl ? getCleanText(titleEl) : '';
      }
      return '';
    }
  },

  // 3. GREENHOUSE ADAPTER
  Greenhouse: {
    detectPageType() {
      // Greenhouse boards pages are single job descriptions or forms
      if (document.querySelector('h1.app-title') || document.querySelector('#header h1') || document.querySelector('#grnhse_app')) {
        return 'details';
      }
      return null;
    },

    scrapeVisibleCardJobs() {
      return []; // Single details page only
    },

    scrapeActiveJobDetails() {
      const titleEl = document.querySelector('h1.app-title, #header h1, h1');
      const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';

      const companyEl = document.querySelector('.company-name, meta[property="og:title"]');
      let company = '';
      if (companyEl) {
        if (companyEl.tagName === 'META') {
          const ogTitle = companyEl.getAttribute('content') || '';
          // Greenhouse og:title is usually "Job Title at Company"
          const parts = ogTitle.split(/\s+at\s+/i);
          if (parts.length > 1) company = parts[parts.length - 1];
        } else {
          company = companyEl.textContent.trim();
        }
      }
      if (!company) {
        company = document.title.split(/\s+at\s+/i)[1] || document.title.split('-')[0] || 'Company';
      }

      const locEl = document.querySelector('.location, .loc');
      const locationText = locEl ? locEl.textContent.trim().replace(/\s+/g, ' ') : 'Open / Remote';

      const descEl = document.querySelector('#content, #main, #details, div[id*="job-description"]');
      const description = descEl ? descEl.textContent.trim() : document.body.textContent.trim();

      if (!title || !description || description.length < 200) return null;

      // Extract unique ID from URL
      const urlMatch = window.location.href.match(/gh_jid=(\d+)/) || window.location.href.match(/\/jobs\/(\d+)/);
      const jobId = urlMatch ? urlMatch[1] : hashCode(title + company);

      return {
        jobId: jobId,
        title: title,
        company: company.replace(/\s+/g, ' ').trim(),
        locationText: locationText,
        description: description
      };
    },

    injectCardBadge(cardElement, score, isEstimated) {
      // Greenhouse has no job cards list, details only
    }
  },

  // 4. LEVER ADAPTER
  Lever: {
    detectPageType() {
      if (document.querySelector('.lever-posting') || document.querySelector('.posting-header') || document.querySelector('.posting-headline')) {
        return 'details';
      }
      return null;
    },

    scrapeVisibleCardJobs() {
      return []; // Details page
    },

    scrapeActiveJobDetails() {
      const titleEl = document.querySelector('.posting-header h2, .posting-headline h2, h2');
      const title = titleEl ? titleEl.textContent.trim().replace(/\s+/g, ' ') : '';

      // Company name from title "Company - Role" or metadata
      let company = document.title.split('-')[0] || '';
      const logoEl = document.querySelector('.company-logo img');
      if (logoEl && logoEl.alt) {
        company = logoEl.alt.replace(/logo/i, '');
      }

      const locEl = document.querySelector('.posting-categories .location, .posting-category');
      const locationText = locEl ? locEl.textContent.trim().replace(/\s+/g, ' ') : 'Open / Remote';

      const descEl = document.querySelector('.section.page-centered, .posting-description, .posting-requirements');
      const description = descEl ? descEl.textContent.trim() : document.body.textContent.trim();

      if (!title || !description || description.length < 200) return null;

      const urlParts = window.location.pathname.split('/');
      const jobId = urlParts[urlParts.length - 1] || hashCode(title + company);

      return {
        jobId: jobId,
        title: title,
        company: company.replace(/\s+/g, ' ').trim(),
        locationText: locationText,
        description: description
      };
    },

    injectCardBadge(cardElement, score, isEstimated) {
      // Lever has no cards
    }
  },

  // 5. UNSTOP ADAPTER
  Unstop: {
    detectPageType() {
      const url = window.location.href.toLowerCase();
      const isDetails = /\/opportunities\/[a-zA-Z0-9\-]+/.test(url) && !url.includes('/opportunities?') && !url.endsWith('/opportunities') && !url.endsWith('/opportunities/');
      if (isDetails) {
        return 'details';
      }
      return 'list';
    },

    scrapeVisibleCardJobs() {
      const jobs = [];
      
      const selectors = [
        'app-opportunity-card',
        '.opportunity_card',
        '.opportunity-card',
        '[class*="opportunity-card"]',
        '[class*="opportunity_card"]',
        '.job-card',
        '.card'
      ];

      let cardElements = [];
      for (const sel of selectors) {
        const found = document.querySelectorAll(sel);
        const valid = Array.from(found).filter(el => {
          const text = el.textContent || '';
          return el.offsetHeight > 80 && (text.includes('Posted') || text.includes('left') || text.includes('Apply') || text.includes('internship') || text.includes('job') || text.includes('Internship') || text.includes('Job'));
        });
        if (valid.length > 0) {
          cardElements = valid;
          break;
        }
      }

      if (cardElements.length === 0) {
        const headings = document.querySelectorAll('h3, h4, h2, .title, [class*="title"]');
        const candidateCards = new Set();
        headings.forEach(heading => {
          const txt = heading.textContent.trim();
          if (txt.length > 5 && txt.length < 100 && (txt.includes('Internship') || txt.includes('Developer') || txt.includes('Engineer') || txt.includes('Manager') || txt.includes('Analyst') || txt.includes('Designer') || txt.includes('Executive') || txt.includes('Associate') || txt.includes('Hiring') || txt.includes('Job') || txt.includes('Ambassador'))) {
            let parent = heading.parentElement;
            while (parent && parent !== document.body) {
              const pTxt = parent.textContent || '';
              if (parent.offsetHeight > 100 && parent.offsetHeight < 400 && (pTxt.includes('Posted') || pTxt.includes('left') || pTxt.includes('Apply'))) {
                candidateCards.add(parent);
                break;
              }
              parent = parent.parentElement;
            }
          }
        });
        cardElements = Array.from(candidateCards);
      }

      cardElements.forEach((el, index) => {
        const titleEl = el.querySelector('h3, h4, h2, .title, [class*="title"], [class*="heading"]');
        const title = titleEl ? getCleanText(titleEl) : '';
        if (!title) return;

        let company = '';
        const companyEl = el.querySelector('.company, [class*="company"], [class*="subtitle"], .company-name');
        if (companyEl) {
          company = getCleanText(companyEl);
        } else {
          if (titleEl) {
            let next = titleEl.nextElementSibling;
            while (next) {
              const txt = next.textContent.trim();
              if (txt.length > 1 && txt.length < 60 && !txt.includes('Posted') && !txt.includes('left') && !txt.includes('experience')) {
                company = txt;
                break;
              }
              next = next.nextElementSibling;
            }
          }
        }

        let locationText = 'Open / Remote';
        const locationEl = el.querySelector('.location, [class*="location"], [class*="map-marker"]');
        if (locationEl) {
          locationText = getCleanText(locationEl);
        } else {
          const text = el.textContent || '';
          if (text.includes('Work from Home') || text.includes('Work From Home') || text.includes('wfh') || text.includes('WFH') || text.includes('Work from home')) {
            locationText = 'Remote';
          } else if (text.includes('Hybrid')) {
            const match = text.match(/Hybrid\s+([A-Za-z\s]+)/i);
            locationText = match ? `Hybrid (${match[1].trim()})` : 'Hybrid';
          } else {
            const badges = el.querySelectorAll('span, div, p');
            for (const badge of badges) {
              const bTxt = badge.textContent.trim();
              if (bTxt.length > 2 && bTxt.length < 30 && (bTxt.includes('Remote') || bTxt.includes('Home') || bTxt.includes('Office') || bTxt.includes('Delhi') || bTxt.includes('Mumbai') || bTxt.includes('Bengaluru') || bTxt.includes('Bangalore') || bTxt.includes('Pune') || bTxt.includes('Hyderabad') || bTxt.includes('Chennai') || bTxt.includes('Kolkata') || bTxt.includes('Jodhpur') || bTxt.includes('Gurgaon') || bTxt.includes('Noida') || bTxt.includes('India'))) {
                locationText = bTxt;
                break;
              }
            }
          }
        }

        let jobId = null;
        let opportunityUrl = '';
        const links = el.querySelectorAll('a');
        for (const link of links) {
          const href = link.href || '';
          const match = href.match(/\/opportunities\/([A-Za-z0-9\-]+)/);
          if (match) {
            jobId = match[1];
            opportunityUrl = href;
            break;
          }
        }
        if (!jobId) {
          jobId = el.getAttribute('id') || `unstop-${index}-${hashCode(title + company)}`;
        }
        if (!opportunityUrl && links.length > 0) {
          opportunityUrl = links[0].href;
        }

        jobs.push({
          jobId: jobId,
          title: title.replace(/\s+/g, ' ').trim(),
          company: company.replace(/\s+/g, ' ').trim() || 'Unstop Opportunity',
          locationText: locationText.replace(/\s+/g, ' ').trim(),
          element: el,
          opportunityUrl: opportunityUrl || (jobId ? `https://unstop.com/opportunities/${jobId}` : '')
        });
      });

      return jobs;
    },

    scrapeActiveJobDetails() {
      const url = window.location.href.toLowerCase();
      const isDetails = /\/opportunities\/[a-zA-Z0-9\-]+/.test(url) && !url.includes('/opportunities?') && !url.endsWith('/opportunities') && !url.endsWith('/opportunities/');
      if (!isDetails) {
        return null;
      }

      const titleEl = document.querySelector('h1, h2.title, [class*="opportunity-details"] h1, [class*="detail"] h1, .opportunity-title');
      const title = titleEl ? getCleanText(titleEl) : '';
      
      let company = '';
      const companyEl = document.querySelector('.company-name, [class*="company"], [class*="organisation"]');
      if (companyEl) {
        company = getCleanText(companyEl);
      }
      
      let locationText = 'Open / Remote';
      const locationEl = document.querySelector('.location-text, [class*="location"]');
      if (locationEl) {
        locationText = getCleanText(locationEl);
      }
      
      const descEl = document.querySelector('.job-description, .opportunity-description, #description, [class*="description"], [class*="about"], .opportunity-details-container');
      let description = descEl ? descEl.textContent.trim() : '';
      
      if (!description) {
        const mainEl = document.querySelector('main, article, .content-container, #content');
        if (mainEl) description = mainEl.textContent.trim();
      }
      
      if (!title || !description) return null;
      
      const jobId = hashCode(title + company);
      
      return {
        jobId: jobId,
        title: title,
        company: company || 'Employer',
        locationText: locationText,
        description: description
      };
    },

    injectCardBadge(cardElement, score, isEstimated) {
      injectBadgeGeneric(cardElement, score, isEstimated);
    },

    scrapeActiveCardTitle() {
      const activeCard = document.querySelector(
        '[class*="active"] .opportunity_card, ' +
        '[class*="selected"] .opportunity_card, ' +
        '.opportunity_card[class*="active"], ' +
        '.opportunity_card[class*="selected"]'
      );
      if (activeCard) {
        const titleEl = activeCard.querySelector('h3, h4, h2, .title');
        return titleEl ? getCleanText(titleEl) : '';
      }
      return '';
    }
  },

  // 6. GENERIC ADAPTER
  Generic: {
    detectPageType() {
      // Heuristic: check if we find a title and a substantial description element
      const title = this.getJobTitle();
      const desc = this.getJobDescription();
      
      if (title && desc && desc.length > 300) {
        // Verify description has some job-related terms to prevent false positives on random blogs
        const hasJobKeywords = /requirements|qualifications|skills|responsibilities|experience|about the role|description/i.test(desc);
        if (hasJobKeywords) {
          return 'details';
        }
      }
      return null;
    },

    scrapeVisibleCardJobs() {
      return [];
    },

    scrapeActiveJobDetails() {
      const title = this.getJobTitle();
      const description = this.getJobDescription();
      if (!title || !description) return null;

      const company = this.getCompany();
      const locationText = this.getLocation();
      const jobId = hashCode(title + company);

      return {
        jobId: jobId,
        title: title,
        company: company,
        locationText: locationText,
        description: description
      };
    },

    injectCardBadge() {},

    // Heuristics for generic pages
    getJobTitle() {
      // Try common title selectors
      const selectors = [
        'h1.job-title', '.job-title', '[class*="job-title"] h1', '[class*="posting-title"] h1',
        'h1.title', '.posting-header h1', '.posting-headline h1'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 3) {
          return el.textContent.trim();
        }
      }
      
      // Fallback: look for the first h1
      const h1s = document.querySelectorAll('h1');
      for (const h1 of h1s) {
        if (h1.textContent.trim().length > 3 && !/careers|jobs|opportunities/i.test(h1.textContent)) {
          return h1.textContent.trim();
        }
      }
      
      return null;
    },

    getJobDescription() {
      const selectors = [
        '#job-details', '.job-details', '#job-description', '.job-description',
        '[class*="job-description"]', '[id*="job-description"]', '.posting-description',
        '#jobdesc', '.jobdesc', 'article', '#main-content', '.main-content'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 300) {
          return el.textContent.trim();
        }
      }
      
      // Fallback: find the largest text container in the page
      const divs = document.querySelectorAll('div, section');
      let bestText = '';
      divs.forEach(el => {
        // Make sure it doesn't contain a ton of script/style characters
        const txt = el.textContent.trim();
        if (txt.length > bestText.length && txt.length < 15000) {
          // Verify it contains job post keywords
          if (/requirements|qualifications|skills|experience/i.test(txt)) {
            bestText = txt;
          }
        }
      });
      
      return bestText || null;
    },

    getCompany() {
      // Check og:site_name meta tag
      const metaOgSite = document.querySelector('meta[property="og:site_name"]');
      if (metaOgSite && metaOgSite.getAttribute('content')) {
        return metaOgSite.getAttribute('content').trim();
      }
      
      // Check og:title and split
      const metaOgTitle = document.querySelector('meta[property="og:title"]');
      if (metaOgTitle && metaOgTitle.getAttribute('content')) {
        const title = metaOgTitle.getAttribute('content');
        const parts = title.split(/\s+at\s+|\s+-\s+|\s+\|\s+/i);
        if (parts.length > 1) return parts[1].trim();
      }

      // Check title split
      const docTitle = document.title;
      const parts = docTitle.split(/\s+at\s+|\s+-\s+|\s+\|\s+/i);
      if (parts.length > 1 && parts[1].trim().length > 2) return parts[1].trim();

      return 'Employer';
    },

    getLocation() {
      const selectors = [
        '.location', '.job-location', '[class*="location"]', '[id*="location"]',
        '.workplace', '.job-metadata'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim().length > 2 && el.textContent.trim().length < 80) {
          return el.textContent.trim().replace(/\s+/g, ' ');
        }
      }
      return 'Open / Remote';
    }
  }
};

// Generic Badge Injector (Helper)
function injectBadgeGeneric(cardElement, score, isEstimated) {
  if (!cardElement) return;

  // Use :scope selector to search only direct children, preventing double/duplicate badges on nested elements
  let badge = cardElement.querySelector(':scope > .jc-injected-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'jc-injected-badge';
    
    const computedStyle = window.getComputedStyle(cardElement);
    if (computedStyle.position === 'static') {
      cardElement.style.position = 'relative';
    }
    cardElement.appendChild(badge);
  }

  let colorClass = 'jc-badge-low';
  if (score >= 80) {
    colorClass = 'jc-badge-high';
  } else if (score >= 65) {
    colorClass = 'jc-badge-med';
  }

  // Detect platform to support adaptive CSS positioning rules
  const host = window.location.hostname.toLowerCase();
  const path = window.location.pathname.toLowerCase();
  let platformClass = 'jc-platform-generic';
  
  if (host.includes('linkedin.com') || path.includes('test_form.html')) {
    platformClass = 'jc-platform-linkedin';
  } else if (host.includes('indeed.com')) {
    platformClass = 'jc-platform-indeed';
  } else if (host.includes('unstop.com')) {
    platformClass = 'jc-platform-unstop';
  }

  badge.className = `jc-injected-badge ${colorClass} ${platformClass}`;
  
  const estHtml = isEstimated ? ' <span class="jc-badge-est">EST</span>' : '';
  badge.innerHTML = `<span class="jc-badge-val">${score}%</span>${estHtml}`;
}

// Simple hash generator for string
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'gen-' + Math.abs(hash);
}

// Export based on execution environment
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SiteAdapter;
} else {
  window.SiteAdapter = SiteAdapter;
}
