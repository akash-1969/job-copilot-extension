// DOM elements
const statusCard = document.getElementById('status-card');
const statusIcon = document.getElementById('status-icon');
const statusTitle = document.getElementById('status-title');
const statusDesc = document.getElementById('status-desc');
const openDashboardBtn = document.getElementById('open-dashboard-btn');

document.addEventListener('DOMContentLoaded', checkProfileStatus);
openDashboardBtn.addEventListener('click', openDashboard);

function checkProfileStatus() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get('profile', (result) => {
      statusCard.classList.remove('loading');
      
      if (result.profile && result.profile.fullName) {
        // Profile exists and has at least a name
        statusCard.classList.add('success');
        statusCard.classList.remove('missing');
        statusTitle.innerText = 'Profile Ready';
        statusDesc.innerText = `Autofill active for ${result.profile.fullName}.`;
        
        // Update SVG icon to Checkmark
        statusIcon.innerHTML = `
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        `;
      } else {
        // Profile is missing
        statusCard.classList.add('missing');
        statusCard.classList.remove('success');
        statusTitle.innerText = 'Profile Incomplete';
        statusDesc.innerText = 'Upload a resume to set up autofill.';
        
        // Update SVG icon to Warning Exclamation
        statusIcon.innerHTML = `
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        `;
      }
    });
  } else {
    // Dev context simulation
    statusCard.className = 'status-card missing';
    statusTitle.innerText = 'Simulation Mode';
    statusDesc.innerText = 'Running outside of extension environment.';
  }
}

function openDashboard() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
    window.close();
  } else {
    // Simulation mode
    alert('Opening dashboard...');
    window.open('../options/options.html', '_blank');
  }
}
