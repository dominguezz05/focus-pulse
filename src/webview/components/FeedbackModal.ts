import { AppState } from "../../state/StateTypes";

export class FeedbackModal {
  static render(isVisible: boolean = false): string {
    return `
      <!-- Feedback Modal -->
      <div id="feedback-modal" class="fixed inset-0 z-50 flex items-center justify-center ${isVisible ? "" : "hidden"}" style="background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(8px);">
        <div class="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden border border-slate-700/50 animate-scale-in">
          <!-- Header -->
          <div class="bg-gradient-to-r from-blue-500/20 to-purple-500/20 px-6 py-4 border-b border-slate-700/50">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl">
                  💭
                </div>
                <div>
                  <h3 class="text-lg font-bold text-slate-100">Your opinion matters</h3>
                  <p class="text-xs text-slate-400">Help us improve Focus Pulse</p>
                </div>
              </div>
              <button id="feedback-close" class="text-slate-400 hover:text-slate-200 transition-colors text-2xl leading-none" title="Close">
                ×
              </button>
            </div>
          </div>

          <!-- Body -->
          <div class="px-6 py-5">
            <p class="text-slate-300 text-sm mb-4">
              What would you like to see in Focus Pulse? Any bugs to report? Let us know! 🚀
            </p>

            <form id="feedback-form" action="https://formsubmit.co/ikerdc2005@gmail.com" method="POST">
              <!-- Honeypot for spam prevention -->
              <input type="text" name="_honey" style="display:none">

              <!-- Disable captcha -->
              <input type="hidden" name="_captcha" value="false">

              <!-- Custom subject -->
              <input type="hidden" name="_subject" value="🎯 New Feedback from Focus Pulse!">

              <!-- Success page -->
              <input type="hidden" name="_next" value="https://github.com/dominguezz05/focus-pulse/issues">

              <!-- User Info (auto-filled) -->
              <input type="hidden" id="feedback-user-level" name="User Level" value="">
              <input type="hidden" id="feedback-user-xp" name="Total XP" value="">
              <input type="hidden" id="feedback-version" name="Version" value="2.7.0">

              <!-- Feedback Type -->
              <div class="mb-4">
                <label class="block text-slate-300 text-sm font-medium mb-2">
                  Feedback type
                </label>
                <div class="grid grid-cols-3 gap-2">
                  <label class="relative">
                    <input type="radio" name="Type" value="Suggestion" class="peer sr-only" checked>
                    <div class="px-3 py-2 text-center rounded-lg border border-slate-600 cursor-pointer transition-all peer-checked:border-blue-500 peer-checked:bg-blue-500/20 peer-checked:text-blue-300 text-slate-400 text-xs font-medium hover:border-slate-500">
                      💡 Idea
                    </div>
                  </label>
                  <label class="relative">
                    <input type="radio" name="Type" value="Bug" class="peer sr-only">
                    <div class="px-3 py-2 text-center rounded-lg border border-slate-600 cursor-pointer transition-all peer-checked:border-red-500 peer-checked:bg-red-500/20 peer-checked:text-red-300 text-slate-400 text-xs font-medium hover:border-slate-500">
                      🐛 Bug
                    </div>
                  </label>
                  <label class="relative">
                    <input type="radio" name="Type" value="UX Improvement" class="peer sr-only">
                    <div class="px-3 py-2 text-center rounded-lg border border-slate-600 cursor-pointer transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-500/20 peer-checked:text-emerald-300 text-slate-400 text-xs font-medium hover:border-slate-500">
                      ✨ UX
                    </div>
                  </label>
                </div>
              </div>

              <!-- Email (optional) -->
              <div class="mb-4">
                <label for="feedback-email" class="block text-slate-300 text-sm font-medium mb-2">
                  Your email <span class="text-slate-500 text-xs">(optional, for reply)</span>
                </label>
                <input
                  type="email"
                  id="feedback-email"
                  name="Email"
                  placeholder="your@email.com"
                  class="w-full px-3 py-2 bg-slate-700/40 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                >
              </div>

              <!-- Message -->
              <div class="mb-4">
                <label for="feedback-message" class="block text-slate-300 text-sm font-medium mb-2">
                  Your message <span class="text-red-400">*</span>
                </label>
                <textarea
                  id="feedback-message"
                  name="Message"
                  required
                  rows="4"
                  placeholder="Example: I'd like you to add customizable dark mode..."
                  class="w-full px-3 py-2 bg-slate-700/40 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
                ></textarea>
                <p class="text-xs text-slate-500 mt-1">Minimum 10 characters</p>
              </div>

              <!-- Actions -->
              <div class="flex gap-2">
                <button
                  type="button"
                  id="feedback-cancel"
                  class="flex-1 px-4 py-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-all border border-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  class="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/25"
                >
                  Send Feedback 🚀
                </button>
              </div>
            </form>

            <!-- Privacy note -->
            <p class="text-xs text-slate-500 text-center mt-3">
              🔒 Your feedback is private and helps us improve
            </p>
          </div>
        </div>
      </div>

      <!-- Feedback Button (Floating) -->
      <button
        id="feedback-button"
        class="fixed bottom-6 left-6 w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-2xl shadow-blue-500/50 flex items-center justify-center text-2xl transition-all transform hover:scale-110 z-40"
        title="Send feedback"
      >
        💬
      </button>

      <style>
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      </style>
    `;
  }

  static getScript(): string {
    return `
      // Feedback Modal Logic
      (function() {
        const modal = document.getElementById('feedback-modal');
        const btn = document.getElementById('feedback-button');
        const closeBtn = document.getElementById('feedback-close');
        const cancelBtn = document.getElementById('feedback-cancel');
        const form = document.getElementById('feedback-form');

        // Open modal
        function openFeedbackModal() {
          modal.classList.remove('hidden');
        }

        // Close modal
        function closeFeedbackModal() {
          modal.classList.add('hidden');
        }

        // Event listeners
        btn.addEventListener('click', openFeedbackModal);
        closeBtn.addEventListener('click', closeFeedbackModal);
        cancelBtn.addEventListener('click', closeFeedbackModal);

        // Close on outside click
        modal.addEventListener('click', function(e) {
          if (e.target === modal) {
            closeFeedbackModal();
          }
        });

        // Form submit handling
        form.addEventListener('submit', function(e) {
          e.preventDefault(); // Prevent navigation

          const message = document.getElementById('feedback-message').value;
          if (message.length < 10) {
            alert('Please write at least 10 characters in your message.');
            return;
          }

          // Collect feedback data
          const feedbackData = {
            type: document.querySelector('input[name="Type"]:checked').value,
            message: message,
            email: document.getElementById('feedback-email').value || undefined,
            userLevel: parseInt(document.getElementById('feedback-user-level').value) || 0,
            userXp: parseInt(document.getElementById('feedback-user-xp').value) || 0,
            version: document.getElementById('feedback-version').value
          };

          // Disable submit button to prevent double-submit
          const submitBtn = form.querySelector('button[type="submit"]');
          const originalText = submitBtn.textContent;
          submitBtn.disabled = true;
          submitBtn.textContent = 'Sending...';

          // Send to FormSubmit via AJAX (email backup)
          const formData = new FormData(form);
          fetch(form.action, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json'
            }
          }).catch(err => {
            console.warn('FormSubmit error (non-critical):', err);
          });

          // Send to backend for GitHub issue creation
          vscode.postMessage({
            type: 'feedback:sent',
            payload: {
              timestamp: Date.now(),
              feedbackData: feedbackData
            }
          });

          // Close modal and reset form
          setTimeout(() => {
            closeFeedbackModal();
            form.reset();
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
            localStorage.setItem('focusPulse.feedbackSent', Date.now().toString());
          }, 500);
        });

        // Auto-fill user info
        window.fillFeedbackUserInfo = function(level, xp) {
          document.getElementById('feedback-user-level').value = level || 'N/A';
          document.getElementById('feedback-user-xp').value = xp || 'N/A';
        };

        // Auto-show logic (show once after conditions met)
        window.checkAutoShowFeedback = function(state) {
          const lastShown = localStorage.getItem('focusPulse.feedbackLastShown');
          const feedbackSent = localStorage.getItem('focusPulse.feedbackSent');

          // Don't show if already sent or shown in last 30 days
          if (feedbackSent || (lastShown && Date.now() - parseInt(lastShown) < 30 * 24 * 60 * 60 * 1000)) {
            return;
          }

          // Conditions to auto-show:
          // 1. Level 5+ reached
          // 2. 10+ achievements unlocked
          // 3. 7+ days of usage (streak)
          const shouldShow = (
            state.xp && state.xp.level >= 5 ||
            state.achievements && state.achievements.unlocked.length >= 7 ||
            state.streak >= 5
          );

          if (shouldShow) {
            setTimeout(() => {
              openFeedbackModal();
              localStorage.setItem('focusPulse.feedbackLastShown', Date.now().toString());
            }, 3000); // Show after 3 seconds
          }
        };
      })();
    `;
  }
}
