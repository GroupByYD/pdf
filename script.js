/* =========================================================
   YatraDham Quotation Builder
   Modules: state | rooms | images | calculations | validation
            | preview rendering | pdf generation | utilities
   ========================================================= */

(function () {
  'use strict';

  const LOGO_URL = 'https://cdn.yatradham.org/skin/frontend/default/ydhome/yd_newtheme/images/logo.png';
  const WATERMARK_URL = 'https://raw.githubusercontent.com/dhruvrajgohilyatradham-rgb/pdf/refs/heads/main/image.png';

  const BRAND = {
    wine: [74, 24, 52],
    maroon: [109, 35, 75],
    orange: [249, 115, 22],
    orangeDark: [234, 88, 12],
    cream: [255, 245, 238],
    bg: [249, 250, 251],
    border: [229, 231, 235],
    textMain: [31, 41, 55],
    textBody: [75, 85, 99],
    textDesc: [107, 114, 128],
    white: [255, 255, 255]
  };

  /* ---------------------------------------------------------
     STATE
  --------------------------------------------------------- */
  const state = {
    property: { name: '', url: '', videoUrl: '', reviewUrl: '' },
    stay: { checkin: '', checkinTime: '14:00', checkout: '', checkoutTime: '11:00', guests: null },
    rooms: [],
    charges: { tax: 5, platform: 17.34 },
    images: [],
    terms: { customPoint: '' }
  };

  let roomCounter = 0;
  let imageCounter = 0;
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  /* ---------------------------------------------------------
     DEFAULT TERMS & CONDITIONS (verbatim company content)
  --------------------------------------------------------- */
  const TERMS_BEFORE_CUSTOM = [
    'According to government rules and regulations, all guests must bring a valid government ID proof (Aadhar Card/Driving License/Pan Card/Passport/Voter ID) at the time of check-in. Guests are not allowed under the age of 18. Single Guest or Unmarried couples are not allowed. Guests staying in the same city are not allowed. YatraDham is not responsible for any refund in case of failure to check in.',
    'Guest cannot bring any illegal things at the accommodation.',
    'Please note that almost all the rooms/halls have a certain capacity for the guests/room, it is mentioned on the page. This limit is strictly followed.',
    'The standard check-in time and check-out times are mentioned on the page. Please make sure to be on time. Hence, early check-in or late check-out is not allowed. This might be chargeable and subject to availability. Many accommodations have gate-closing rules mentioned on the property page. During this period check-in might not be possible (depending on accommodation) and is non-refundable.',
    'In cases of the Pay at check-in option guests must reach before 3:00 PM. If you arrive late before the mentioned time then you have to update in advance. Otherwise, your room will be canceled and YatraDham is not responsible for it.',
    'YatraDham is not responsible for the facilities provided as per booking details. Also, take a look at special notes, which are to be followed compulsorily. Some Amenities (hot water, food, parking, TV, AC) may be chargeable or subject to availability. Due to interrupted supplies like electricity, some facilities (e.g., AC, geyser) may not work.'
  ];

  const TERMS_AFTER_CUSTOM = [
    'There are Dharamshala/Bhavan/Ashram/Sanatorium which can be booked only for the Yatris following principles of a certain religion. It is mentioned for each room type. YatraDham is not liable for any kind of refund in case of violation of these rules.',
    'Accommodation management can change or stop providing facilities without notice. In That case, YatraDham is not liable.',
    'A booking confirmation confirms that we have received your accommodation request. However, it is subject to Dharamshala management\u2019s modification/cancellation in case of any unfavourable situation and YatraDham.org management cannot be held responsible or liable for any such changes.',
    'Please note that in case of any incident/event, YatraDham\u2019s liability is limited to the convenience fee only. Our services are provided to the best of our ability and the information we have received from others. Any information, opinion, statement, recommendation or anything whatsoever shall not form a guarantee. While we can advise you, it is your responsibility to ensure that products and services meet your particular needs before booking.',
    'YatraDham.org is not responsible for loss, theft, or forgotten items. Also, not liable for incidents preventing arrival due to weather, events, curfews, emergencies etc.',
    'Issues reported after check-out are considered feedback only, with no further updates.',
    'Pets and outside food/alcohol and non-veg food are not allowed. Some properties do not provide lock and key facilities so it is advisable to bring your lock and key.',
    'The jurisdiction for any dispute arising out of this service shall be Bhavnagar, Gujarat.',
    'We may change these terms at any time by posting notifications online.',
    'www.yatradham.org is not endorsing or promoting any particular place or religion. We are working to promote religious tourism.'
  ];

  /* ---------------------------------------------------------
     UTILITIES
  --------------------------------------------------------- */
  function formatINR(amount) {
    if (!isFinite(amount)) amount = 0;
    const isNeg = amount < 0;
    amount = Math.abs(amount);
    const hasDecimal = Math.abs(amount - Math.round(amount)) > 0.004;
    const fixed = hasDecimal ? amount.toFixed(2) : String(Math.round(amount));
    const [intPart, decPart] = fixed.split('.');
    let lastThree = intPart.slice(-3);
    const other = intPart.slice(0, -3);
    if (other !== '') lastThree = ',' + lastThree;
    const formattedInt = other.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    return (isNeg ? '-' : '') + '\u20B9' + formattedInt + (decPart ? '.' + decPart : '');
  }

  // Standard PDF fonts (helvetica/times/courier) use WinAnsi encoding and cannot
  // render the \u20B9 Rupee glyph -- it prints as a missing/blank character.
  // The PDF always uses "Rs." instead; the on-screen preview keeps the \u20B9 symbol.
  function formatINRPdf(amount) {
    if (!isFinite(amount)) amount = 0;
    const isNeg = amount < 0;
    amount = Math.abs(amount);
    const hasDecimal = Math.abs(amount - Math.round(amount)) > 0.004;
    const fixed = hasDecimal ? amount.toFixed(2) : String(Math.round(amount));
    const [intPart, decPart] = fixed.split('.');
    let lastThree = intPart.slice(-3);
    const other = intPart.slice(0, -3);
    if (other !== '') lastThree = ',' + lastThree;
    const formattedInt = other.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
    return (isNeg ? '-' : '') + 'Rs. ' + formattedInt + (decPart ? '.' + decPart : '');
  }

  // Converts a 24-hour "HH:MM" string into { hour12, period } for populating
  // the hour/AM-PM select pair.
  function from24Hour(timeStr) {
    const parts = (timeStr || '').split(':');
    let h = parseInt(parts[0], 10);
    if (isNaN(h)) h = 0;
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return { hour12: h12, period };
  }

  // Converts a 12-hour value + AM/PM period back into a 24-hour "HH:00"
  // string for internal state (minutes are always :00 — hour-only picker).
  function to24Hour(hour12, period) {
    let h = parseInt(hour12, 10);
    if (isNaN(h)) h = 12;
    if (period === 'AM') { if (h === 12) h = 0; } else { if (h !== 12) h += 12; }
    return `${String(h).padStart(2, '0')}:00`;
  }

  // Populates an hour/period select pair from a 24-hour "HH:MM" string.
  function setTimeSelects(hourEl, periodEl, timeStr) {
    const { hour12, period } = from24Hour(timeStr);
    if (hourEl) hourEl.value = String(hour12);
    if (periodEl) periodEl.value = period;
  }

  function formatDatePretty(isoDate) {
    if (!isoDate) return '\u2014';
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return '\u2014';
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  // Converts a 24-hour "HH:MM" input value into a friendly 12-hour label,
  // e.g. "14:00" -> "2:00 PM". Returns '' for empty/invalid input so callers
  // can decide whether to show it at all.
  function formatTimePretty(timeStr) {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m)) return '';
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(m).padStart(2, '0')} ${period}`;
  }

  // Combines a date and an optional time into one display string, e.g.
  // "24 Aug 2026, 2:00 PM" or just "24 Aug 2026" if no time is set.
  function formatDateTimePretty(isoDate, timeStr) {
    const datePart = formatDatePretty(isoDate);
    const timePart = formatTimePretty(timeStr);
    if (!timePart || datePart === '\u2014') return datePart;
    return `${datePart}, ${timePart}`;
  }

  function daysBetween(startIso, endIso) {
    if (!startIso || !endIso) return 0;
    const start = new Date(startIso + 'T00:00:00');
    const end = new Date(endIso + 'T00:00:00');
    if (isNaN(start) || isNaN(end)) return 0;
    const diff = Math.round((end - start) / 86400000);
    return diff;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  /* ---------------------------------------------------------
     DOM REFERENCES
  --------------------------------------------------------- */
  const el = {
    propertyName: document.getElementById('propertyName'),
    propertyUrl: document.getElementById('propertyUrl'),
    videoUrl: document.getElementById('videoUrl'),
    reviewUrl: document.getElementById('reviewUrl'),
    checkinDate: document.getElementById('checkinDate'),
    checkinHour: document.getElementById('checkinHour'),
    checkinPeriod: document.getElementById('checkinPeriod'),
    checkoutDate: document.getElementById('checkoutDate'),
    checkoutHour: document.getElementById('checkoutHour'),
    checkoutPeriod: document.getElementById('checkoutPeriod'),
    guestCount: document.getElementById('guestCount'),
    staySummary: document.getElementById('staySummary'),
    roomsList: document.getElementById('roomsList'),
    addRoomBtn: document.getElementById('addRoomBtn'),
    taxPercent: document.getElementById('taxPercent'),
    platformPercent: document.getElementById('platformPercent'),
    imagesList: document.getElementById('imagesList'),
    addImageBtn: document.getElementById('addImageBtn'),
    customTermPoint: document.getElementById('customTermPoint'),
    errorBanner: document.getElementById('errorBanner'),
    generateStatus: document.getElementById('generateStatus'),
    resetBtn: document.getElementById('resetBtn'),
    resetModal: document.getElementById('resetModal'),
    resetCancelBtn: document.getElementById('resetCancelBtn'),
    resetConfirmBtn: document.getElementById('resetConfirmBtn'),
    roomTemplate: document.getElementById('roomTemplate'),
    imageTemplate: document.getElementById('imageTemplate'),
    // preview
    pvPropertyName: document.getElementById('pvPropertyName'),
    pvLinks: document.getElementById('pvLinks'),
    pvStay: document.getElementById('pvStay'),
    pvRoomTableBody: document.getElementById('pvRoomTableBody'),
    pvSummaryTableBody: document.getElementById('pvSummaryTableBody'),
    pvFinalTotal: document.getElementById('pvFinalTotal'),
    pvPerPerson: document.getElementById('pvPerPerson')
  };

  /* ---------------------------------------------------------
     ROOM MANAGEMENT
  --------------------------------------------------------- */
  function addRoom(data) {
    const room = {
      id: uid('room'),
      type: (data && data.type) || '',
      price: data && data.price != null ? data.price : null,
      guestsPerRoom: data && data.guestsPerRoom != null ? data.guestsPerRoom : null,
      count: data && data.count != null ? data.count : null,
      description: (data && data.description) || ''
    };
    state.rooms.push(room);
    renderRooms();
    onChange();
  }

  function removeRoom(id) {
    state.rooms = state.rooms.filter((r) => r.id !== id);
    renderRooms();
    onChange();
  }

  function renderRooms() {
    el.roomsList.innerHTML = '';
    state.rooms.forEach((room, idx) => {
      const node = el.roomTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.roomId = room.id;
      node.querySelector('.room-card__badge').textContent = `Room ${idx + 1}`;
      const typeInput = node.querySelector('.room-type');
      const priceInput = node.querySelector('.room-price');
      const guestsInput = node.querySelector('.room-guests');
      const countInput = node.querySelector('.room-count');
      const descInput = node.querySelector('.room-desc');

      typeInput.value = room.type;
      priceInput.value = room.price != null ? room.price : '';
      guestsInput.value = room.guestsPerRoom != null ? room.guestsPerRoom : '';
      countInput.value = room.count != null ? room.count : '';
      descInput.value = room.description;

      typeInput.addEventListener('input', () => { room.type = typeInput.value; onChange(); });
      priceInput.addEventListener('input', () => { room.price = priceInput.value === '' ? null : parseFloat(priceInput.value); updateRoomCalc(node, room); onChange(); });
      guestsInput.addEventListener('input', () => { room.guestsPerRoom = guestsInput.value === '' ? null : parseInt(guestsInput.value, 10); onChange(); });
      countInput.addEventListener('input', () => { room.count = countInput.value === '' ? null : parseInt(countInput.value, 10); updateRoomCalc(node, room); onChange(); });
      descInput.addEventListener('input', () => { room.description = descInput.value; });

      node.querySelector('.room-card__remove').addEventListener('click', () => removeRoom(room.id));

      el.roomsList.appendChild(node);
      updateRoomCalc(node, room);
    });
  }

  function updateRoomCalc(node, room) {
    const nights = Math.max(daysBetween(state.stay.checkin, state.stay.checkout), 0);
    const calcEl = node.querySelector('.room-card__calc');
    const price = room.price || 0;
    const count = room.count || 0;
    if (!price || !count || !nights) {
      calcEl.innerHTML = `Subtotal will appear once price, room count and valid dates are set.`;
      return;
    }
    const subtotal = price * count * nights;
    calcEl.innerHTML = `${formatINR(price)} &times; ${count} room(s) &times; ${nights} night(s) = <strong>${formatINR(subtotal)}</strong>`;
  }

  /* ---------------------------------------------------------
     IMAGE MANAGEMENT
  --------------------------------------------------------- */
  function addImage(data) {
    const image = {
      id: uid('img'),
      url: (data && data.url) || '',
      description: (data && data.description) || ''
    };
    state.images.push(image);
    renderImages();
  }

  function removeImage(id) {
    state.images = state.images.filter((i) => i.id !== id);
    renderImages();
  }

  function renderImages() {
    el.imagesList.innerHTML = '';
    state.images.forEach((image) => {
      const node = el.imageTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.imageId = image.id;
      const urlInput = node.querySelector('.image-url');
      const descInput = node.querySelector('.image-desc');
      const thumb = node.querySelector('.image-card__thumb');
      const placeholder = node.querySelector('.image-card__placeholder');

      urlInput.value = image.url;
      descInput.value = image.description;

      const refreshThumb = () => {
        if (!image.url) {
          thumb.style.display = 'none';
          placeholder.style.display = 'block';
          placeholder.textContent = 'No preview yet';
          return;
        }
        thumb.onload = () => { thumb.style.display = 'block'; placeholder.style.display = 'none'; };
        thumb.onerror = () => { thumb.style.display = 'none'; placeholder.style.display = 'block'; placeholder.textContent = 'Image unavailable'; };
        thumb.src = image.url;
      };
      refreshThumb();

      urlInput.addEventListener('input', () => { image.url = urlInput.value; refreshThumb(); });
      descInput.addEventListener('input', () => { image.description = descInput.value; });
      node.querySelector('.image-card__remove').addEventListener('click', () => removeImage(image.id));

      el.imagesList.appendChild(node);
    });
  }

  /* ---------------------------------------------------------
     CALCULATIONS
  --------------------------------------------------------- */
  function computeNights() {
    const n = daysBetween(state.stay.checkin, state.stay.checkout);
    return n > 0 ? n : 0;
  }

  function roomIsUsable(room) {
    return room.price != null && room.price >= 0 &&
      room.count != null && room.count > 0 &&
      room.guestsPerRoom != null && room.guestsPerRoom > 0;
  }

  function computeRoomSubtotal(room, nights) {
    if (!roomIsUsable(room)) return 0;
    return room.price * room.count * nights;
  }

  function computeTotals() {
    const nights = computeNights();
    let roomSubtotal = 0;
    state.rooms.forEach((room) => { roomSubtotal += computeRoomSubtotal(room, nights); });
    const taxPct = isFinite(state.charges.tax) ? state.charges.tax : 0;
    const platformPct = isFinite(state.charges.platform) ? state.charges.platform : 0;
    const taxAmount = roomSubtotal * (taxPct / 100);
    const platformBase = roomSubtotal + taxAmount;
    const platformAmount = platformBase * (platformPct / 100);
    const finalTotal = roomSubtotal + taxAmount + platformAmount;
    const guests = state.stay.guests || 0;
    const perPerson = guests > 0 ? finalTotal / guests : 0;
    return { nights, roomSubtotal, taxAmount, platformAmount, finalTotal, perPerson, guests };
  }

  /* ---------------------------------------------------------
     VALIDATION
  --------------------------------------------------------- */
  function clearFieldErrors() {
    document.querySelectorAll('.field--error').forEach((f) => f.classList.remove('field--error'));
  }

  function validate() {
    const errors = [];
    clearFieldErrors();

    if (!state.property.name || !state.property.name.trim()) {
      errors.push('Please enter the Dharamshala / property name.');
      el.propertyName.classList.add('field--error');
    }
    if (!state.stay.checkin) {
      errors.push('Please select a check-in date.');
      el.checkinDate.classList.add('field--error');
    }
    if (!state.stay.checkout) {
      errors.push('Please select a check-out date.');
      el.checkoutDate.classList.add('field--error');
    }
    if (state.stay.checkin && state.stay.checkout && daysBetween(state.stay.checkin, state.stay.checkout) < 1) {
      errors.push('Please enter a check-out date after the check-in date.');
      el.checkoutDate.classList.add('field--error');
    }
    if (!state.stay.guests || state.stay.guests <= 0) {
      errors.push('Please enter the number of guests (greater than 0).');
      el.guestCount.classList.add('field--error');
    }
    if (state.rooms.length === 0) {
      errors.push('Please add at least one room type.');
    } else {
      state.rooms.forEach((room, idx) => {
        const label = `Room ${idx + 1}`;
        const cardNode = el.roomsList.querySelector(`[data-room-id="${room.id}"]`);
        if (!room.type || !room.type.trim()) {
          errors.push(`${label}: please enter a room type.`);
          if (cardNode) cardNode.querySelector('.room-type').classList.add('field--error');
        }
        if (room.price == null || room.price < 0) {
          errors.push(`${label}: room price must be 0 or more.`);
          if (cardNode) cardNode.querySelector('.room-price').classList.add('field--error');
        }
        if (!room.guestsPerRoom || room.guestsPerRoom <= 0) {
          errors.push(`${label}: guests per room must be greater than 0.`);
          if (cardNode) cardNode.querySelector('.room-guests').classList.add('field--error');
        }
        if (!room.count || room.count <= 0) {
          errors.push(`${label}: number of rooms must be greater than 0.`);
          if (cardNode) cardNode.querySelector('.room-count').classList.add('field--error');
        }
      });
    }
    if (state.charges.tax == null || state.charges.tax < 0) {
      errors.push('Government tax cannot be negative.');
      el.taxPercent.classList.add('field--error');
    }
    if (state.charges.platform == null || state.charges.platform < 0) {
      errors.push('Platform charge cannot be negative.');
      el.platformPercent.classList.add('field--error');
    }
    return errors;
  }

  function showErrors(errors) {
    if (!errors.length) {
      el.errorBanner.hidden = true;
      el.errorBanner.innerHTML = '';
      return;
    }
    el.errorBanner.hidden = false;
    el.errorBanner.innerHTML = `<strong>Please fix the following before generating the PDF:</strong><ul>${errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`;
    el.errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ---------------------------------------------------------
     PREVIEW RENDERING
  --------------------------------------------------------- */
  function renderPreview() {
    const totals = computeTotals();

    el.pvPropertyName.textContent = state.property.name && state.property.name.trim() ? state.property.name : 'Property name';

    el.pvLinks.innerHTML = '';
    const linkDefs = [
      { url: state.property.videoUrl, label: 'Watch Property Video' },
      { url: state.property.reviewUrl, label: 'Read Customer Reviews' },
      { url: state.property.url, label: 'View Property on YatraDham' }
    ];
    linkDefs.forEach((l) => {
      if (l.url && l.url.trim()) {
        const a = document.createElement('span');
        a.className = 'pdf-link';
        a.textContent = l.label;
        el.pvLinks.appendChild(a);
      }
    });

    el.pvStay.innerHTML = `
      <div class="stay-block">Check-in<strong>${formatDateTimePretty(state.stay.checkin, state.stay.checkinTime)}</strong></div>
      <div class="stay-block">Check-out<strong>${formatDateTimePretty(state.stay.checkout, state.stay.checkoutTime)}</strong></div>
      <div class="stay-block">Duration<strong>${totals.nights} night${totals.nights === 1 ? '' : 's'} &bull; ${totals.guests || 0} guest${totals.guests === 1 ? '' : 's'}</strong></div>
    `;

    if (state.rooms.length === 0) {
      el.pvRoomTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#9CA3AF;padding:14px;">No rooms added yet</td></tr>`;
    } else {
      el.pvRoomTableBody.innerHTML = state.rooms.map((room) => {
        const subtotal = computeRoomSubtotal(room, totals.nights);
        return `<tr>
          <td>${escapeHtml(room.type || '\u2014')}</td>
          <td>${room.guestsPerRoom || '\u2014'} Guests</td>
          <td>${room.price != null ? formatINR(room.price) : '\u2014'}</td>
          <td>${room.count || '\u2014'}</td>
          <td>${totals.nights || '\u2014'}</td>
          <td class="ta-r">${formatINR(subtotal)}</td>
        </tr>`;
      }).join('');
    }

    el.pvSummaryTableBody.innerHTML = `
      <tr><td>Room Total</td><td class="ta-r">${formatINR(totals.roomSubtotal)}</td></tr>
      <tr><td>Government Tax (${state.charges.tax || 0}%)</td><td class="ta-r">${formatINR(totals.taxAmount)}</td></tr>
      <tr><td>Platform Charge (${state.charges.platform || 0}%)</td><td class="ta-r">${formatINR(totals.platformAmount)}</td></tr>
      <tr class="total-row"><td>GRAND TOTAL</td><td class="ta-r">${formatINR(totals.finalTotal)}</td></tr>
    `;

    el.pvFinalTotal.innerHTML = `
      <div class="label">GRAND TOTAL</div>
      <div class="amount">${formatINR(totals.finalTotal)}</div>
    `;

    el.pvPerPerson.innerHTML = `
      Approx. per-person cost for <strong>${totals.guests || 0}</strong> guest(s) over <strong>${totals.nights}</strong> night(s):
      <div style="margin-top:4px;"><strong style="font-size:20px;">${formatINR(totals.perPerson)}</strong></div>
      <span class="approx-label">Approximate per-person cost \u2014 actual contribution may vary by room allocation.</span>
    `;
  }

  /* ---------------------------------------------------------
     STATE SYNC (inputs -> state)
  --------------------------------------------------------- */
  function bindSimpleInputs() {
    el.propertyName.addEventListener('input', () => { state.property.name = el.propertyName.value; onChange(); });
    el.propertyUrl.addEventListener('input', () => { state.property.url = el.propertyUrl.value; onChange(); });
    el.videoUrl.addEventListener('input', () => { state.property.videoUrl = el.videoUrl.value; onChange(); });
    el.reviewUrl.addEventListener('input', () => { state.property.reviewUrl = el.reviewUrl.value; onChange(); });

    el.checkinDate.addEventListener('input', () => { state.stay.checkin = el.checkinDate.value; renderRooms(); onChange(); });
    el.checkinHour.addEventListener('change', () => { state.stay.checkinTime = to24Hour(el.checkinHour.value, el.checkinPeriod.value); onChange(); });
    el.checkinPeriod.addEventListener('change', () => { state.stay.checkinTime = to24Hour(el.checkinHour.value, el.checkinPeriod.value); onChange(); });
    el.checkoutDate.addEventListener('input', () => { state.stay.checkout = el.checkoutDate.value; renderRooms(); onChange(); });
    el.checkoutHour.addEventListener('change', () => { state.stay.checkoutTime = to24Hour(el.checkoutHour.value, el.checkoutPeriod.value); onChange(); });
    el.checkoutPeriod.addEventListener('change', () => { state.stay.checkoutTime = to24Hour(el.checkoutHour.value, el.checkoutPeriod.value); onChange(); });
    el.guestCount.addEventListener('input', () => { state.stay.guests = el.guestCount.value === '' ? null : parseInt(el.guestCount.value, 10); onChange(); });

    el.taxPercent.addEventListener('input', () => { state.charges.tax = el.taxPercent.value === '' ? 0 : parseFloat(el.taxPercent.value); onChange(); });
    el.platformPercent.addEventListener('input', () => { state.charges.platform = el.platformPercent.value === '' ? 0 : parseFloat(el.platformPercent.value); onChange(); });

    el.customTermPoint.addEventListener('input', () => { state.terms.customPoint = el.customTermPoint.value; });

    el.addRoomBtn.addEventListener('click', () => addRoom());
    el.addImageBtn.addEventListener('click', () => addImage());
  }

  function onChange() {
    renderPreview();
    // live-update every room subtotal line (nights may have changed)
    document.querySelectorAll('.room-card').forEach((node) => {
      const room = state.rooms.find((r) => r.id === node.dataset.roomId);
      if (room) updateRoomCalc(node, room);
    });
  }

  /* ---------------------------------------------------------
     RESET
  --------------------------------------------------------- */
  function openResetModal() { el.resetModal.hidden = false; }
  function closeResetModal() { el.resetModal.hidden = true; }

  function resetAll() {
    state.property = { name: '', url: '', videoUrl: '', reviewUrl: '' };
    state.stay = { checkin: '', checkinTime: '14:00', checkout: '', checkoutTime: '11:00', guests: null };
    state.rooms = [];
    state.charges = { tax: 5, platform: 17.34 };
    state.images = [];
    state.terms = { customPoint: '' };

    el.propertyName.value = '';
    el.propertyUrl.value = '';
    el.videoUrl.value = '';
    el.reviewUrl.value = '';
    el.checkinDate.value = '';
    setTimeSelects(el.checkinHour, el.checkinPeriod, '14:00');
    el.checkoutDate.value = '';
    setTimeSelects(el.checkoutHour, el.checkoutPeriod, '11:00');
    el.guestCount.value = '';
    el.taxPercent.value = 5;
    el.platformPercent.value = 17.34;
    el.customTermPoint.value = '';

    addRoom();
    renderImages();
    clearFieldErrors();
    showErrors([]);
    onChange();
    closeResetModal();
  }

  /* ---------------------------------------------------------
     SAMPLE DATA
  --------------------------------------------------------- */
  function loadSampleData() {
    state.property = {
      name: 'Swaminarayan Bhaktidham',
      url: 'https://www.yatradham.org/',
      videoUrl: '',
      reviewUrl: ''
    };
    const inTwoWeeks = new Date();
    inTwoWeeks.setDate(inTwoWeeks.getDate() + 14);
    const checkout = new Date(inTwoWeeks);
    checkout.setDate(checkout.getDate() + 2);
    state.stay = {
      checkin: inTwoWeeks.toISOString().slice(0, 10),
      checkinTime: '14:00',
      checkout: checkout.toISOString().slice(0, 10),
      checkoutTime: '11:00',
      guests: 4
    };

    el.propertyName.value = state.property.name;
    el.propertyUrl.value = state.property.url;
    el.checkinDate.value = state.stay.checkin;
    setTimeSelects(el.checkinHour, el.checkinPeriod, state.stay.checkinTime);
    el.checkoutDate.value = state.stay.checkout;
    setTimeSelects(el.checkoutHour, el.checkoutPeriod, state.stay.checkoutTime);
    el.guestCount.value = state.stay.guests;
    el.taxPercent.value = state.charges.tax;
    el.platformPercent.value = state.charges.platform;

    addRoom({ type: 'Deluxe Room', price: 500, guestsPerRoom: 2, count: 2, description: 'Suitable for families and couples.' });
  }

  /* ---------------------------------------------------------
     PDF GENERATION
  --------------------------------------------------------- */
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlDimensions(dataUrl) {
    return new Promise((resolve, reject) => {
      const probe = new Image();
      probe.onload = () => resolve({ width: probe.naturalWidth || 1, height: probe.naturalHeight || 1 });
      probe.onerror = reject;
      probe.src = dataUrl;
    });
  }

  // Two-step attempt: (1) fetch + FileReader, which succeeds whenever the host
  // sends CORS headers, then (2) an <img>+canvas fallback for hosts that allow
  // hot-linking but not fetch. If both fail (no CORS support at all) the caller
  // falls back to a labelled placeholder rather than breaking the PDF.
  async function loadImageAsDataURL(url) {
    if (!url || !url.trim()) return null;

    try {
      const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (resp.ok) {
        const blob = await resp.blob();
        const dataUrl = await blobToDataURL(blob);
        const dims = await dataUrlDimensions(dataUrl);
        return { dataUrl, width: dims.width, height: dims.height };
      }
    } catch (e) { /* fall through to canvas attempt */ }

    return new Promise((resolve) => {
      let settled = false;
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || 1;
          canvas.height = img.naturalHeight || 1;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          finish({ dataUrl, width: canvas.width, height: canvas.height });
        } catch (e) {
          finish(null); // canvas tainted -- host has no CORS support
        }
      };
      img.onerror = () => finish(null);
      img.src = url;
      setTimeout(() => finish(null), 8000);
    });
  }

  function sanitizeFilename(name) {
    return (name || 'Quotation').replace(/[^a-z0-9\-]+/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  }

  // Vector wordmark -- draws entirely with jsPDF shapes/text, so it renders
  // reliably even when the remote logo image can't be fetched (e.g. no CORS
  // headers on the CDN). Used as a fallback when the real raster logo fails
  // to load at all.
  function drawBrandMark(doc, x, y) {
    const cy = y + 4.6;
    doc.setFillColor(...BRAND.white);
    doc.circle(x + 4.6, cy, 4.6, 'F');
    doc.setFillColor(...BRAND.wine);
    doc.triangle(x + 4.6, cy - 2.6, x + 2.5, cy + 2, x + 6.7, cy + 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...BRAND.white);
    doc.text('YatraDham', x + 11.5, cy + 2.4);
  }

  // Computes how tall the orange header band needs to be so a full-width
  // logo fits nicely. Clamped so a very wide/tall logo can't blow out the
  // layout. Falls back to a fixed height if no logo asset is available.
  function computeHeaderHeight(doc, logoAsset) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const minH = 18;
    const maxH = 34;
    if (!logoAsset) return minH;
    const ratio = logoAsset.width / logoAsset.height;
    const fullWidthLogoH = pageWidth / ratio;
    return Math.min(Math.max(fullWidthLogoH + 8, minH), maxH);
  }

  // Orange, full-width header band. The logo is stretched to span the full
  // page width (minus a little breathing room) and centered vertically/
  // horizontally within the band. Falls back to the vector wordmark if the
  // real logo image couldn't be loaded.
  async function drawPageHeader(doc, logoAsset, headerH) {
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor(...BRAND.orange);
    doc.rect(0, 0, pageWidth, headerH, 'F');

    let usedRealLogo = false;
    if (logoAsset) {
      const ratio = logoAsset.width / logoAsset.height;
      let w = pageWidth;
      let h = w / ratio;
      const maxLogoH = headerH - 6;
      if (h > maxLogoH) { h = maxLogoH; w = h * ratio; }
      const logoX = (pageWidth - w) / 2;
      const logoY = (headerH - h) / 2;
      try {
        doc.addImage(logoAsset.dataUrl, 'PNG', logoX, logoY, w, h);
        usedRealLogo = true;
      } catch (e) { /* fall through to vector mark */ }
    }

    if (!usedRealLogo) {
      drawBrandMark(doc, 12, (headerH - 9) / 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.white);
      doc.text('PILGRIMAGE  \u2022  STAY  \u2022  EXPERIENCE', pageWidth - 12, headerH / 2 + 3, { align: 'right' });
    }

    doc.setTextColor(...BRAND.textMain);
  }

  function drawPageFooter(doc, pageNum, totalPages) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...BRAND.border);
    doc.setLineWidth(0.2);
    doc.line(12, pageHeight - 14, pageWidth - 12, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...BRAND.textDesc);
    doc.text('YatraDham.org \u2014 Religious Tourism & Pilgrimage Services', 12, pageHeight - 9);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - 12, pageHeight - 9, { align: 'right' });
  }

  // Faint, centered watermark image drawn behind page content. Silently
  // no-ops if the watermark asset failed to load, so a broken/blocked URL
  // never breaks PDF generation.
  function drawWatermark(doc, watermarkAsset) {
    if (!watermarkAsset) return;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ratio = watermarkAsset.width / watermarkAsset.height;
    let w = pageWidth * 0.6;
    let h = w / ratio;
    const maxH = pageHeight * 0.6;
    if (h > maxH) { h = maxH; w = h * ratio; }
    const x = (pageWidth - w) / 2;
    const y = (pageHeight - h) / 2;
    try {
      doc.saveGraphicsState();
      doc.setGState(new doc.GState({ opacity: 0.08 }));
      doc.addImage(watermarkAsset.dataUrl, 'PNG', x, y, w, h);
      doc.restoreGraphicsState();
    } catch (e) { /* skip watermark if it fails to draw */ }
  }

  function drawRoundedInfoBox(doc, x, y, w, h, fillRgb, borderRgb) {
    doc.setFillColor(...fillRgb);
    if (borderRgb) { doc.setDrawColor(...borderRgb); doc.setLineWidth(0.3); doc.roundedRect(x, y, w, h, 2.2, 2.2, 'FD'); }
    else { doc.roundedRect(x, y, w, h, 2.2, 2.2, 'F'); }
  }

  async function generatePDF() {
    const errors = validate();
    showErrors(errors);
    if (errors.length) return;

    const { jsPDF } = window.jspdf;
    el.generateStatus.textContent = 'Preparing your quotation\u2026';
    const genButtons = [
      document.getElementById('generatePdfBtnTop'),
      document.getElementById('generatePdfBtnBottom'),
      document.getElementById('generatePdfBtnMobile')
    ];
    genButtons.forEach((b) => { if (b) b.disabled = true; });

    try {
      const [logoAsset, watermarkAsset, ...imageAssets] = await Promise.all([
        loadImageAsDataURL(LOGO_URL),
        loadImageAsDataURL(WATERMARK_URL),
        ...state.images.map((img) => loadImageAsDataURL(img.url))
      ]);

      const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 12;
      const contentW = pageWidth - marginX * 2;

      // Header height depends on the logo's aspect ratio, so compute it once
      // up front and reuse everywhere a page break redraws the header.
      const HEADER_H = computeHeaderHeight(doc, logoAsset);
      const CONTENT_TOP = HEADER_H + 8;
      const TABLE_TOP_MARGIN = HEADER_H + 6;
      let y = CONTENT_TOP;

      await drawPageHeader(doc, logoAsset, HEADER_H);

      // Property name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(...BRAND.wine);
      const propName = state.property.name || 'Property';
      const propNameLines = doc.splitTextToSize(propName, contentW);
      doc.text(propNameLines, marginX, y);
      y += propNameLines.length * 7.5 + 2;

      // Links row
      const links = [];
      if (state.property.videoUrl) links.push({ label: 'Watch Property Video', url: state.property.videoUrl });
      if (state.property.reviewUrl) links.push({ label: 'Read Customer Reviews', url: state.property.reviewUrl });
      if (state.property.url) links.push({ label: 'View Property on YatraDham', url: state.property.url });

      if (links.length) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        let lx = marginX;
        links.forEach((link) => {
          const label = link.label;
          const w = doc.getTextWidth(label) + 6;
          if (lx + w > pageWidth - marginX) { lx = marginX; y += 8; }
          drawRoundedInfoBox(doc, lx, y - 4.2, w, 6.4, BRAND.cream, [243, 217, 198]);
          doc.setTextColor(...BRAND.orangeDark);
          doc.textWithLink(label, lx + 3, y, { url: link.url });
          lx += w + 4;
        });
        y += 10;
        doc.setTextColor(...BRAND.textMain);
      }

      // Stay summary
      const totals = computeTotals();
      const stayBlocks = [
        { label: 'Check-in', value: formatDateTimePretty(state.stay.checkin, state.stay.checkinTime) },
        { label: 'Check-out', value: formatDateTimePretty(state.stay.checkout, state.stay.checkoutTime) },
        { label: 'Duration', value: `${totals.nights} Night${totals.nights === 1 ? '' : 's'} \u2022 ${totals.guests} Guest${totals.guests === 1 ? '' : 's'}` }
      ];
      const blockW = (contentW - 8) / 3;
      stayBlocks.forEach((blk, i) => {
        const bx = marginX + i * (blockW + 4);
        drawRoundedInfoBox(doc, bx, y, blockW, 15, BRAND.bg, null);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(...BRAND.textDesc);
        doc.text(blk.label, bx + 4, y + 5.5);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(...BRAND.wine);
        const valLines = doc.splitTextToSize(blk.value, blockW - 8);
        doc.text(valLines, bx + 4, y + 11);
      });
      y += 22;
      doc.setTextColor(...BRAND.textMain);

      // Room table
const roomRows = state.rooms.map((room) => [
  room.type || '\u2014',
  `${room.guestsPerRoom || 0} Guests`,
  formatINRPdf(room.price || 0),
  String(room.count || 0),
  String(totals.nights),
  formatINRPdf(computeRoomSubtotal(room, totals.nights))
]);

doc.autoTable({
  startY: y,
  margin: {
    left: marginX,
    right: marginX,
    top: TABLE_TOP_MARGIN,
    bottom: 20
  },

  head: [[
    'Room Type',
    'Guests / Room',
    'Room Price',
    'No. of Rooms',
    'Nights',
    'Room Total'
  ]],

  body: roomRows,

  theme: 'grid',

  styles: {
    font: 'helvetica',
    fontSize: 9,
    fontStyle: 'bold',
    textColor: BRAND.textBody,

    // Vertical center
    valign: 'middle',

    // Horizontal center
    halign: 'center',

    cellPadding: {
      top: 3.5,
      bottom: 3.5,
      left: 3,
      right: 3
    },

    lineColor: BRAND.wine,
    lineWidth: 0.4
  },

  headStyles: {
    fillColor: BRAND.wine,
    textColor: BRAND.white,
    fontStyle: 'bold',
    fontSize: 8.5,

    // Center header text
    halign: 'center',
    valign: 'middle',

    lineColor: BRAND.wine,
    lineWidth: 0.4
  },

  alternateRowStyles: {
    fillColor: BRAND.bg
  },

  columnStyles: {
    // Keep EVERY column centered
    0: {
      halign: 'center',
      valign: 'middle'
    },
    1: {
      halign: 'center',
      valign: 'middle'
    },
    2: {
      halign: 'center',
      valign: 'middle'
    },
    3: {
      halign: 'center',
      valign: 'middle'
    },
    4: {
      halign: 'center',
      valign: 'middle'
    },
    5: {
      halign: 'center',
      valign: 'middle',
      fontStyle: 'bold',
      textColor: BRAND.orangeDark
    }
  }
});

y = doc.lastAutoTable.finalY + 8;

      // Summary table
const summaryRows = [
  ['Room Total', formatINRPdf(totals.roomSubtotal)],
  [`GST Tax (${state.charges.tax || 0}%)`, formatINRPdf(totals.taxAmount)],
  ['Platform Charge', formatINRPdf(totals.platformAmount)],
  ['GRAND TOTAL', formatINRPdf(totals.finalTotal)]
];

doc.autoTable({
  startY: y,
  margin: {
    left: marginX,
    right: marginX,
    top: TABLE_TOP_MARGIN,
    bottom: 20
  },
  body: summaryRows,
  theme: 'grid',
  tableWidth: contentW * 0.62,

  styles: {
    font: 'helvetica',
    fontSize: 9.5,
    fontStyle: 'bold',
    textColor: BRAND.textBody,
    cellPadding: 3.5,
    lineColor: BRAND.wine,
    lineWidth: 0.4
  },

  columnStyles: {
    0: {
      fontStyle: 'bold'
    },
    1: {
      halign: 'right',
      fontStyle: 'bold',
      textColor: BRAND.wine
    }
  },

  alternateRowStyles: {
    fillColor: BRAND.bg
  },

  // Style only the GRAND TOTAL row
  didParseCell: function (data) {
    if (data.section === 'body' && data.row.index === summaryRows.length - 1) {
      data.cell.styles.fillColor = BRAND.cream;
      data.cell.styles.textColor = BRAND.wine;
      data.cell.styles.fontStyle = 'bold';
      data.cell.styles.fontSize = 10.5;
      data.cell.styles.lineColor = BRAND.orange;
      data.cell.styles.lineWidth = 0.5;
    }
  }
});

y = doc.lastAutoTable.finalY + 10;

      // Per-person table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(...BRAND.wine);
      doc.text('Per Person Estimate', marginX, y);
      y += 4;
      doc.autoTable({
        startY: y,
        margin: { left: marginX, right: marginX, top: TABLE_TOP_MARGIN, bottom: 20 },
        head: [['Metric', 'Value']],
        body: [
          ['Total Guests', String(totals.guests)],
          ['Total Nights', String(totals.nights)],
          ['GRAND TOTAL', formatINRPdf(totals.finalTotal)],
          ['Approx. Per Person', formatINRPdf(totals.perPerson)]
        ],
        theme: 'grid',
        tableWidth: contentW * 0.62,
        styles: { font: 'helvetica', fontSize: 9.5, fontStyle: 'bold', textColor: BRAND.textBody, cellPadding: 3.5, lineColor: BRAND.maroon, lineWidth: 0.4 },
        headStyles: { fillColor: BRAND.maroon, textColor: BRAND.white, fontStyle: 'bold', fontSize: 9.5, lineColor: BRAND.maroon, lineWidth: 0.4 },
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold', textColor: BRAND.wine } },
        alternateRowStyles: { fillColor: BRAND.bg },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === data.table.body.length - 1) {
            data.cell.styles.fillColor = BRAND.cream;
            data.cell.styles.fontSize = 11;
            data.cell.styles.textColor = data.column.index === 1 ? BRAND.orangeDark : BRAND.wine;
          }
        }
      });
      y = doc.lastAutoTable.finalY + 6;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...BRAND.textDesc);
      doc.text('Approximate per-person cost \u2014 actual contribution may vary by room allocation.', marginX, y);

      /* ---------------- IMAGE PAGES ---------------- */
      const validImages = state.images
        .map((img, idx) => ({ ...img, asset: imageAssets[idx] }))
        .filter((img) => img.url && img.url.trim());

      if (validImages.length) {
        doc.addPage();
        await drawPageHeader(doc, logoAsset, HEADER_H);
        let iy = CONTENT_TOP;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(17);
        doc.setTextColor(...BRAND.wine);
        doc.text('Property Highlights', marginX, iy);
        iy += 8;

        const maxImgW = contentW;
        const maxImgH = 78;

        for (const image of validImages) {
          let boxH = maxImgH + 14;
          if (iy + boxH > 275) {
            doc.addPage();
            await drawPageHeader(doc, logoAsset, HEADER_H);
            iy = CONTENT_TOP;
          }
          if (image.asset) {
            const ratio = image.asset.width / image.asset.height;
            let w = maxImgW, h = w / ratio;
            if (h > maxImgH) { h = maxImgH; w = h * ratio; }
            const bx = marginX + (contentW - w) / 2;
            doc.setDrawColor(...BRAND.border);
            doc.setLineWidth(0.3);
            doc.roundedRect(bx - 1, iy - 1, w + 2, h + 2, 2.5, 2.5, 'S');
            try { doc.addImage(image.asset.dataUrl, 'PNG', bx, iy, w, h); } catch (e) { /* skip broken image */ }
            iy += h + 5;
          } else {
            drawRoundedInfoBox(doc, marginX, iy, contentW, 24, BRAND.bg, BRAND.border);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.setTextColor(...BRAND.textDesc);
            doc.text('Image unavailable', pageWidth / 2, iy + 13.5, { align: 'center' });
            iy += 29;
          }
          if (image.description) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(...BRAND.textBody);
            const descLines = doc.splitTextToSize(image.description, contentW);
            doc.text(descLines, marginX, iy);
            iy += descLines.length * 4.6 + 6;
          } else {
            iy += 6;
          }
        }
      }

      /* ---------------- TERMS & CONDITIONS ---------------- */
      const termsPoints = [...TERMS_BEFORE_CUSTOM];
      const customPoint = (state.terms.customPoint || '').trim();
      if (customPoint) termsPoints.push(customPoint);
      termsPoints.push(...TERMS_AFTER_CUSTOM);

      doc.addPage();
      await drawPageHeader(doc, logoAsset, HEADER_H);
      let ty = CONTENT_TOP;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(17);
      doc.setTextColor(...BRAND.wine);
      doc.text('Terms & Conditions', marginX, ty);
      ty += 6;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.textDesc);
      const subtitleLines = doc.splitTextToSize('By accepting these Terms & Conditions, you agree to be legally bound by the following terms & conditions.', contentW);
      doc.text(subtitleLines, marginX, ty);
      ty += subtitleLines.length * 4.2 + 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(...BRAND.textBody);

      const numberGutter = 6;
      const textIndent = 8;

      for (const [idx, point] of termsPoints.entries()) {
        const numberLabel = `${idx + 1}.`;
        const textLines = doc.splitTextToSize(point, contentW - textIndent);
        const blockH = textLines.length * 4.2 + 3;
        if (ty + blockH > 280) {
          doc.addPage();
          await drawPageHeader(doc, logoAsset, HEADER_H);
          ty = CONTENT_TOP;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.2);
        doc.setTextColor(...BRAND.orangeDark);
        doc.text(numberLabel, marginX + numberGutter, ty, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...BRAND.textBody);
        doc.text(textLines, marginX + textIndent, ty);
        ty += blockH;
      }

      /* ---------------- DISCLAIMER ---------------- */
      const disclaimerLabel = 'DISCLAIMER :';
      const disclaimerText = 'This only Quotation as per your requirements and availability. During booking process may be Price, facility or T&C can be change . that our agent clear while process booking. as well as please read whole quotation properly and if any question or query clear it before booking.';
      const disclaimerLines = doc.splitTextToSize(disclaimerText, contentW);
      const disclaimerBlockH = 4 + disclaimerLines.length * 3.6 + 4;

      if (ty + disclaimerBlockH > 280) {
        doc.addPage();
        await drawPageHeader(doc, logoAsset, HEADER_H);
        ty = CONTENT_TOP;
      } else {
        ty += 5;
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND.textDesc);
      doc.text(disclaimerLabel, marginX, ty);
      ty += 3.6;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...BRAND.textDesc);
      doc.text(disclaimerLines, marginX, ty);

      /* ---------------- WATERMARK + FOOTERS ---------------- */
      const totalPages = doc.internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        drawWatermark(doc, watermarkAsset);
        drawPageFooter(doc, p, totalPages);
      }

      const filename = `YatraDham-Quotation-${sanitizeFilename(state.property.name)}.pdf`;
      doc.save(filename);
      el.generateStatus.textContent = 'PDF generated successfully.';
    } catch (err) {
      console.error(err);
      el.generateStatus.textContent = 'Something went wrong while generating the PDF. Please try again.';
    } finally {
      genButtons.forEach((b) => { if (b) b.disabled = false; });
      setTimeout(() => { el.generateStatus.textContent = ''; }, 4000);
    }
  }

  /* ---------------------------------------------------------
     INIT
  --------------------------------------------------------- */
  function init() {
    bindSimpleInputs();

    document.getElementById('generatePdfBtnTop').addEventListener('click', generatePDF);
    document.getElementById('generatePdfBtnBottom').addEventListener('click', generatePDF);
    document.getElementById('generatePdfBtnMobile').addEventListener('click', generatePDF);

    el.resetBtn.addEventListener('click', openResetModal);
    el.resetCancelBtn.addEventListener('click', closeResetModal);
    el.resetConfirmBtn.addEventListener('click', resetAll);
    el.resetModal.addEventListener('click', (e) => { if (e.target === el.resetModal) closeResetModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.resetModal.hidden) closeResetModal(); });

    loadSampleData();
    renderImages();
    onChange();
  }

  document.addEventListener('DOMContentLoaded', init);
})();