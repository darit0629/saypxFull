(function () {
  let allItems = [];
  let categoryMap = {};

  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const fileNameEl = document.getElementById('fileName');
  const categorySelect = document.getElementById('category');
  const newCatRow = document.getElementById('newCatRow');
  const newCatLabel = document.getElementById('newCatLabel');
  const uploadForm = document.getElementById('uploadForm');
  const progressWrap = document.getElementById('progressWrap');
  const progressBar = document.getElementById('progressBar');
  const statusMsg = document.getElementById('statusMsg');
  const itemGrid = document.getElementById('itemGrid');
  const emptyState = document.getElementById('emptyState');
  const filterCategory = document.getElementById('filterCategory');
  const searchBox = document.getElementById('searchBox');

  const editBackdrop = document.getElementById('editBackdrop');
  const editTitle = document.getElementById('editTitle');
  const editSubtitle = document.getElementById('editSubtitle');
  const editCategory = document.getElementById('editCategory');
  const editCancel = document.getElementById('editCancel');
  const editSave = document.getElementById('editSave');
  let editingIndex = null;

  const deleteBackdrop = document.getElementById('deleteBackdrop');
  const deleteCancel = document.getElementById('deleteCancel');
  const deleteConfirm = document.getElementById('deleteConfirm');
  let deletingIndex = null;

  function populateCategorySelects() {
    const options = Object.entries(categoryMap)
      .map(([slug, label]) => `<option value="${slug}">${label}</option>`)
      .join('');
    categorySelect.innerHTML = options + '<option value="__new__">+ Add new category...</option>';
    editCategory.innerHTML = options;
    filterCategory.innerHTML = '<option value="">All categories</option>' + options;
  }

  categorySelect.addEventListener('change', () => {
    newCatRow.classList.toggle('show', categorySelect.value === '__new__');
  });

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('drag'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag');
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      showFileName();
    }
  });
  fileInput.addEventListener('change', showFileName);
  function showFileName() {
    fileNameEl.textContent = fileInput.files.length ? fileInput.files[0].name : '';
  }

  function showStatus(msg, ok) {
    statusMsg.textContent = msg;
    statusMsg.className = 'status-msg show ' + (ok ? 'ok' : 'err');
  }

  uploadForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!fileInput.files.length) { showStatus('Please choose a file first.', false); return; }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('title', document.getElementById('title').value);
    formData.append('subtitle', document.getElementById('subtitle').value);

    let categoryValue = categorySelect.value;
    if (categoryValue === '__new__') {
      const label = newCatLabel.value.trim();
      if (!label) { showStatus('Enter a name for the new category.', false); return; }
      categoryValue = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      formData.append('newCategoryLabel', label);
    }
    formData.append('category', categoryValue);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/admin/portfolio');
    progressWrap.classList.add('show');
    progressBar.style.width = '0%';
    statusMsg.classList.remove('show');

    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) {
        progressBar.style.width = Math.round((ev.loaded / ev.total) * 100) + '%';
      }
    });

    xhr.onload = () => {
      progressWrap.classList.remove('show');
      try {
        const resp = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && resp.ok) {
          showStatus('Uploaded successfully.', true);
          uploadForm.reset();
          fileNameEl.textContent = '';
          newCatRow.classList.remove('show');
          loadItems();
        } else {
          showStatus(resp.error || 'Upload failed.', false);
        }
      } catch (err) {
        showStatus('Upload failed: ' + xhr.status, false);
      }
    };
    xhr.onerror = () => {
      progressWrap.classList.remove('show');
      showStatus('Network error during upload.', false);
    };
    xhr.send(formData);
  });

  function thumbFor(item) {
    if (item.type === 'video') return item.poster;
    return item.src;
  }

  function renderGrid() {
    const catFilter = filterCategory.value;
    const search = searchBox.value.trim().toLowerCase();
    const filtered = allItems.filter((it) => {
      if (catFilter && it.category !== catFilter) return false;
      if (search && !(it.title || '').toLowerCase().includes(search)) return false;
      return true;
    });

    if (!filtered.length) {
      itemGrid.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    itemGrid.innerHTML = filtered.map((it) => {
      const label = categoryMap[it.category] || it.category;
      const thumb = thumbFor(it);
      return `
        <div class="item-card" data-index="${it._index}">
          <img class="item-thumb" src="/${thumb}" loading="lazy" alt="${escapeHtml(it.title || '')}">
          <div class="item-body">
            <div class="item-cat">${escapeHtml(label)}</div>
            <p class="item-title">${escapeHtml(it.title || '')}</p>
            <p class="item-sub">${escapeHtml(it.subtitle || '')}</p>
            <div class="item-actions">
              <button class="edit" data-index="${it._index}">Edit</button>
              <button class="delete" data-index="${it._index}">Delete</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  itemGrid.addEventListener('click', (e) => {
    const editBtn = e.target.closest('button.edit');
    const delBtn = e.target.closest('button.delete');
    if (editBtn) openEdit(parseInt(editBtn.dataset.index, 10));
    if (delBtn) openDelete(parseInt(delBtn.dataset.index, 10));
  });

  function openEdit(index) {
    const item = allItems.find((i) => i._index === index);
    if (!item) return;
    editingIndex = index;
    editTitle.value = item.title || '';
    editSubtitle.value = item.subtitle || '';
    editCategory.value = item.category;
    editBackdrop.classList.add('show');
  }
  editCancel.addEventListener('click', () => editBackdrop.classList.remove('show'));
  editSave.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/portfolio/' + editingIndex, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle.value,
          subtitle: editSubtitle.value,
          category: editCategory.value
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      editBackdrop.classList.remove('show');
      loadItems();
    } catch (err) {
      alert(err.message);
    }
  });

  function openDelete(index) {
    deletingIndex = index;
    deleteBackdrop.classList.add('show');
  }
  deleteCancel.addEventListener('click', () => deleteBackdrop.classList.remove('show'));
  deleteConfirm.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/admin/portfolio/' + deletingIndex, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      deleteBackdrop.classList.remove('show');
      loadItems();
    } catch (err) {
      alert(err.message);
    }
  });

  filterCategory.addEventListener('change', renderGrid);
  searchBox.addEventListener('input', renderGrid);

  async function loadItems() {
    const res = await fetch('/api/admin/portfolio');
    if (res.status === 401) { location.href = '/admin/login'; return; }
    const data = await res.json();
    allItems = data.items;
    categoryMap = data.categories;
    populateCategorySelects();
    renderGrid();
  }

  loadItems();
})();
