/**
 * Harness Pulse Embeddable Widget
 * Usage: <script src="https://mrb.sh/hp/embed.js"></script>
 *        <div id="harness-pulse"></div>
 */
(function(){
  const target = document.getElementById('harness-pulse');
  if (!target) return;
  const iframe = document.createElement('iframe');
  iframe.src = 'https://mrb.sh/hp/widget.html';
  iframe.style.cssText = 'width:320px;height:320px;border:none;border-radius:6px';
  iframe.title = 'Harness Pulse — AI Coding Tool Rankings';
  iframe.loading = 'lazy';
  target.appendChild(iframe);
})();
