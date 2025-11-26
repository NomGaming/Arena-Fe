const BACKEND_URL = 'https://arena-be.onrender.com' // live backend
//const BACKEND_URL = 'http://localhost:3000' // test backend

let clients = []
// Detect branch by path
let branch = 'ראשון לציון'; // default
if (location.pathname.includes('/herz')) branch = 'הרצליה';
else if (location.pathname.includes('/rosh')) branch = 'ראש העין';
else if (location.pathname.includes('/rishon')) branch = 'ראשון לציון';

// Highlight current tab
document.addEventListener('DOMContentLoaded', function() {
  const tabs = document.querySelectorAll('.branch-tab');
  let highlight = '';
  if (location.pathname.includes('/herz')) highlight = 'הרצליה';
  else if (location.pathname.includes('/rosh')) highlight = 'ראש העין';
  else if (location.pathname.includes('/rishon')) highlight = 'ראשון לציון';

  tabs.forEach(tab => {
    if (tab.textContent.trim() === highlight) tab.classList.add('active');
  });
});



let dirty = false

async function fetchClients() {
  try {
    const res = await fetch(`${BACKEND_URL}/clients?branch=${encodeURIComponent(branch)}`)
    clients = await res.json()
    renderTable()
    updateCounters();
  } catch (err) {
    console.error('Failed to fetch clients', err)
  }
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function getRemainingSeconds(client) {
  if (client.paused || !client.startTimestamp)
    return Math.max(0, client.totalSeconds - client.elapsedSeconds)

  const start = new Date(client.startTimestamp).getTime()
  const now = Date.now()
  const extraElapsed = Math.floor((now - start) / 1000)
  return Math.max(0, client.totalSeconds - (client.elapsedSeconds + extraElapsed))
}

function renderTable() {
  const tbody = document.querySelector('#clientsTable tbody')
  const filter = document.getElementById('filterStatus')?.value || 'all'
  tbody.innerHTML = ''

  clients.forEach(client => {
    const remaining = getRemainingSeconds(client)

    if (filter === 'active' && remaining === 0) return
    if (filter === 'inactive' && remaining > 0) return

    const row = document.createElement('tr')
    row.id = `row-${client.id}`
    row.innerHTML = `
      <td>${client.role}</td>
      <td>${client.name}</td>
      <td>${client.phone || ''}</td>
      <td style="background-color: ${client.paused ? '' : '#d4edda'}">
        <button onclick="toggleTimer('${client.id}')" id="btn-${client.id}">${client.paused ? 'Start' : 'Pause'}</button>
      </td>
      <td id="time-${client.id}" style="background-color: ${client.paused ? '' : '#d4edda'}">${formatTime(remaining)}</td>
      <td><button onclick="addHours('${client.id}')" style="margin-top:4px;">Add&nbsp;Time</button></td>
      <td>${client.buyDate}</td>
      <td><button class="delete" onclick="deleteClient('${client.id}')">Delete</button></td>
      <td>${client.branch || ''}</td>
    `
    tbody.appendChild(row)
  })
  updateCounters();
}

async function toggleTimer(id) {
  const client = clients.find(c => c.id === id)
  if (!client) return

  const password = prompt(`Enter password to ${client.paused ? 'start' : 'pause'} the timer:`)
  if (!password) return

  const res = await fetch(`${BACKEND_URL}/check-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })

  const result = await res.json()
  if (!result.valid) {
    alert('Incorrect password. Action canceled.')
    return
  }

  if (client.paused) {
    client.startTimestamp = new Date().toISOString()
    client.paused = false
  } else {
    const start = new Date(client.startTimestamp).getTime()
    const now = Date.now()
    const extraElapsed = Math.floor((now - start) / 1000)
    client.elapsedSeconds += extraElapsed
    client.startTimestamp = null
    client.paused = true
  }

  await saveClients(password, `${client.paused ? 'Paused' : 'Started'} timer for ${client.name}`)
  await fetchClients()
}

async function deleteClient(id) {
  const password = prompt('Enter password to delete client:')
  if (!password) return
  if (!(await isValidPassword(password))) return

  const confirmed = confirm('Are you sure you want to delete this client?')
  if (!confirmed) return

  const client = clients.find(c => c.id === id)
  
  clients = clients.filter(c => c.id !== id)
  await saveClients(password, `deleted client ${client.name}`)
  await fetchClients()
}

// UPDATED: Modified saveClients function to handle raffle
async function saveClients(passwordOverride = null, actionDesc = 'saved client list', raffleInfo = null) {
  const password = passwordOverride || prompt('Enter password to save changes:')
  if (!password) return
  if (!(await isValidPassword(password))) return

  // Safety: Block empty list save!
  const cleanedClients = clients.filter(c => c.id && c.name && c.totalSeconds > 0)
  if (cleanedClients.length === 0) {
    alert('לא ניתן לשמור רשימה ריקה! פעולה בוטלה.');
    return;
  }

  try {
    const requestBody = { 
      clients: cleanedClients, 
      password, 
      description: actionDesc, 
      branch
    }
    
    // Add raffle info if provided
    if (raffleInfo) {
      requestBody.raffleInfo = raffleInfo
    }

    const resp = await fetch(`${BACKEND_URL}/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })
    if (!resp.ok) {
      const data = await resp.json();
      alert(data.message || 'שגיאה בשמירת לקוחות!');
      return;
    }
    dirty = false
  } catch (err) {
    console.error('Failed to save clients', err)
  }
}

async function isValidPassword(password) {
  const res = await fetch(`${BACKEND_URL}/check-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  })
  const result = await res.json()
  if (!result.valid) {
    alert('Incorrect password.')
    return false
  }
  return true
}

// UPDATED: Modified addHours function to handle raffle
async function addHours(id) {
  const client = clients.find(c => c.id === id)
  if (!client) return

  const hoursInput = prompt(`How many hours to add to ${client.name}?`, '0')
  const minutesInput = prompt(`How many minutes to add to ${client.name}?`, '0')

  const hours = parseInt(hoursInput, 10) || 0
  const minutes = parseInt(minutesInput, 10) || 0

  if (hours <= 0 && minutes <= 0) {
    alert('Please enter a valid number of hours or minutes.')
    return
  }

  const addedSeconds = (hours * 3600) + (minutes * 60)
  client.totalSeconds += addedSeconds

  const totalHoursAdded = addedSeconds / 3600
  // NEW: Check if client should be added to raffle (4+ hours added)
  let raffleInfo = null
  if (totalHoursAdded >= 4) {
    raffleInfo = {
      name: client.name,
      phone: client.phone,
      hoursAdded: totalHoursAdded
    }
  }

  await saveClients(null, `added ${hours} hours and ${minutes} minutes to ${client.name}`, raffleInfo)
  await fetchClients()
}

// UPDATED: Modified form submission to handle raffle for new clients
document.getElementById('addClientForm').addEventListener('submit', async (e) => {
  e.preventDefault()

  const id = crypto.randomUUID()
  const name = document.getElementById('clientName').value.trim();
  if (name.length < 5 || !name.includes(' ')) {
    alert('חייב להזין שם מלא (שם פרטי ושם משפחה, עם רווח ביניהם).');
    return;
  }
  const phone = document.getElementById('clientPhone').value.trim();
  if (!/^[0][0-9]{9}$/.test(phone)) {
    alert('חייב מספר פלאפון מלא! (10 ספרות)');
    return;
  }
  const role = document.getElementById('clientRole').value
  const hours = parseInt(document.getElementById('hours').value, 10) || 0
  const minutes = parseInt(document.getElementById('minutes').value, 10) || 0
  const seconds = (hours * 3600) + (minutes * 60)
  const totalHours = seconds / 3600
  const today = new Date().toISOString().slice(0, 10)

  const duplicateName = clients.some(
    c => c.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (duplicateName) {
    alert('שם זה כבר קיים במערכת.');
    return;
  }
  
/*
  const duplicatePhone = clients.some(
    c => c.phone.trim() === phone
  );
  if (duplicatePhone) {
    alert('מספר טלפון זה כבר קיים במערכת.');
    return;
  }
  */

  if (!id || !name || !phone || seconds <= 0) {
    alert('אנא מלא את כל השדות כראוי. חובה להכניס לפחות שעה או דקות.');
    return;
  }

  const password = prompt('Enter password to add client:')
  if (!password || !(await isValidPassword(password))) return

  const newClient = {
    id,
    name,
    phone,
    role,
    buyDate: today,
    totalSeconds: seconds,
    elapsedSeconds: 0,
    startTimestamp: null,
    paused: true,
    branch
  }
  clients.push(newClient); 

  // NEW: Check if client should be added to raffle (4+ hours)
  let raffleInfo = null
  if (totalHours >= 4) {
    raffleInfo = {
      name: name,
      phone: phone,
      hoursAdded: totalHours
    }
  }

  await saveClients(password, `added client ${name}`, raffleInfo)
  await fetchClients()
  alert(`משתמש ${name} נוסף בהצלחה!`)

  // NEW: trigger WhatsApp invite (non-blocking)
  fetch(`${BACKEND_URL}/wa-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, phone, password })
  }).catch(err => console.error('WA invite failed:', err))

  document.getElementById('addClientForm').reset()
})

function updateCounters() {
  let total = clients.length;
  let active = 0;
  let inactive = 0;
  let playingNow = 0;

  clients.forEach(client => {
    const remaining = getRemainingSeconds(client);

    if (remaining > 5) {
      active++;
    } else {
      inactive++;
    }

    if (!client.paused) {
      playingNow++;
    }
  });

  document.getElementById('totalCounter').textContent = total;
  document.getElementById('activeCounter').textContent = active;
  document.getElementById('inactiveCounter').textContent = inactive;
  document.getElementById('playingNowCounter').textContent = playingNow;
}

function updateDisplayedTimes() {
  clients.forEach(client => {
    const remaining = getRemainingSeconds(client)
    const timeElement = document.getElementById(`time-${client.id}`)
    const rowElement = document.getElementById(`row-${client.id}`)

    if (timeElement) timeElement.textContent = formatTime(remaining)
    if (rowElement)
      rowElement.style.backgroundColor = remaining <= 600 && remaining > 0 ? '#ffcccc' : ''

    if (remaining <= 0 && !client.paused && client.totalSeconds > 0) {
      // Add final elapsed time before pausing
      const start = new Date(client.startTimestamp).getTime()
      const now = Date.now()
      const extraElapsed = Math.floor((now - start) / 1000)
      client.elapsedSeconds += extraElapsed

      client.paused = true
      client.startTimestamp = null
      renderTable()
      //saveClients(null, `Auto-paused ${client.name} (time expired)`, true)
      logAutoPause(client.id, client.name)
      alert(`Client ${client.name} has finished their time.`)
    }
  })
}

let currentSort = { key: null, asc: true }

function sortTable(key) {
  if (currentSort.key === key) currentSort.asc = !currentSort.asc
  else currentSort = { key, asc: true }

  clients.sort((a, b) => {
    let valA, valB

    switch (key) {
      case 'role': valA = a.role; valB = b.role; break
      case 'name': valA = a.name; valB = b.name; break
      case 'phone': valA = a.phone; valB = b.phone; break
      case 'buyDate': valA = a.buyDate; valB = b.buyDate; break
      case 'remaining': valA = getRemainingSeconds(a); valB = getRemainingSeconds(b); break
      default: return 0
    }

    if (typeof valA === 'string') {
      valA = valA.toLowerCase()
      valB = valB.toLowerCase()
    }

    return valA < valB ? (currentSort.asc ? -1 : 1) : valA > valB ? (currentSort.asc ? 1 : -1) : 0
  })

  renderTable()
}

async function logAutoPause(clientId, clientName) {
  try {
    await fetch(`${BACKEND_URL}/log-auto-pause`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientName, branch })
    })
  } catch (err) {
    console.error('Failed to log auto-pause:', err)
  }
}

document.querySelectorAll('.floating-input input').forEach(input => {
  const parent = input.parentElement

  const checkActive = () => {
    if (input.value.trim() !== '') {
      parent.classList.add('active')
    } else {
      parent.classList.remove('active')
    }
  }

  // Run on load and on input change
  checkActive()
  input.addEventListener('input', checkActive)
})

setInterval(updateDisplayedTimes, 1000)

/*
setInterval(() => {
  if (!dirty) fetchClients().catch(() => {})
}, 30000)
*/

fetchClients()