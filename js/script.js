/* =========================================
   RubyEngine — Script
========================================= */

// Filter chip toggle
document.querySelectorAll('.re-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const group = chip.parentElement;
    group.querySelectorAll('.re-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

// Search filter (placeholder — hanya demo)
document.querySelectorAll('.re-search input').forEach(input => {
  input.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const grid = document.querySelector('.re-grid');
    if (!grid) return;
    grid.querySelectorAll('.re-card').forEach(card => {
      const title = card.querySelector('.re-card-title')?.textContent || '';
      card.style.display = title.toLowerCase().includes(q) ? '' : 'none';
    });
  });
});