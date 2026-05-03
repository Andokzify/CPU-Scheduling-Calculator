  // 1. CONFIGURATION & COLORS
  const JOB_COLORS = [
    "#FF0000", "#00FF41", "#00E5FF", "#FFD700",
    "#FF00FF", "#FF8C00", "#FFFFFF", "#7FFF00"
  ];

  const getColor = (index) => JOB_COLORS[index % JOB_COLORS.length];

  // 2. GLOBAL STATE
  const state = {
    jobs: [],
    nextJobId: 1,
    hasCalculated: false
  };

  // 3. INITIALIZATION
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("resetBtn").addEventListener("click", resetApp);
    buildTable();
  });

  // 4. TABLE MANAGEMENT
  function buildTable() {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    state.jobs.forEach((job, i) => {
      const color = getColor(i);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="color-dot" style="background: ${color};"></span>${job.id}</td>
        <td><input type="number" value="${job.arrival}" min="0" 
                  oninput="highlightIfBad(this, 'arrival')" 
                  onchange="updateJob(${i}, 'arrival', this.value)"></td>
        <td><input type="number" value="${job.burst}" min="1" 
                  oninput="highlightIfBad(this, 'burst')" 
                  onchange="updateJob(${i}, 'burst', this.value)"></td>
        <td><input type="number" value="${job.priority}" min="1" 
                  oninput="highlightIfBad(this, 'priority')" 
                  onchange="updateJob(${i}, 'priority', this.value)"></td>
        <td><button class="del-btn" onclick="deleteJob(${i})">✕</button></td>
      `;
      tbody.appendChild(row);
    });

    document.getElementById("jobCount").textContent = state.jobs.length;
  }

  function updateJob(index, field, value) {
    let num = parseFloat(value);
    if (field === 'arrival' || field === 'burst') {
      num = isNaN(num) ? 0 : Math.floor(Math.abs(num));
    }
    state.jobs[index][field] = num;
  }

  // 5. JOB OPERATIONS (Add, Remove, Delete)
  function addJob() {
    state.jobs.push({ 
      id: "J" + state.nextJobId++, 
      arrival: "", 
      burst: "", 
      priority: "" 
    });
    buildTable();
    hideError();
  }

  function removeJob() {
    if (state.jobs.length > 1) {
      state.jobs.pop();
      buildTable();
      hideError();
    } else {
      showError("You need at least 1 job!");
    }
  }

  function deleteJob(index) {
    if (state.jobs.length <= 1) {
      showError("You need at least 1 job!");
      return;
    }
    state.jobs.splice(index, 1);
    buildTable();
    hideError();
  }

  // 6. VALIDATION
  function saveTableData() {
    document.querySelectorAll("#tableBody tr").forEach((row, i) => {
      const inputs = row.querySelectorAll("input");
      state.jobs[i].arrival = parseInt(inputs[0].value) || 0;
      state.jobs[i].burst = parseInt(inputs[1].value) || 0;
      state.jobs[i].priority = parseInt(inputs[2].value) || 0;
    });
  }

  function validate() {
    saveTableData();
    for (let job of state.jobs) {
      if (isNaN(job.arrival) || isNaN(job.burst) || isNaN(job.priority)) {
        showError(`${job.id}: All fields must be filled.`);
        return false;
      }
      if (job.arrival < 0) return showError(`${job.id}: Arrival cannot be negative.`), false;
      if (job.burst < 1) return showError(`${job.id}: Burst must be at least 1.`), false;
      if (job.priority < 1) return showError(`${job.id}: Priority must be at least 1.`), false;
    }
    return true;
  }

  // 7. MAIN CALCULATION CONTROLLER
  function calculate(e) {
    if (e?.type === "change" && !state.hasCalculated) return hideError();
    if (state.jobs.length === 0 || !validate()) return;

    state.hasCalculated = true;
    const algo = document.getElementById("algorithm").value;
    const ganttBlocks = runSchedulingAlgorithm(algo);

    if (!ganttBlocks) return showError("Algorithm not implemented.");

    const results = calculateResults(ganttBlocks);
    refreshResultAnimations();

    displayGantt(ganttBlocks);
    displayTAT(results);
    displayWT(results);
    displayTimeline();
    displayCPU(ganttBlocks);
  }

  function runSchedulingAlgorithm(algo) {
    switch (algo) {
      case "FCFS": return runFCFS();
      case "NPP":  return runNPP();
      case "SJF":  return runSJF();
      case "SRTF": return runSRTF();
      default: return null;
    }
  }

  // 8. SCHEDULING ALGORITHMS (Core Logic)
  function runFCFS() {
    const sorted = [...state.jobs].sort((a, b) => a.arrival - b.arrival);
    const gantt = [];
    let clock = 0;

    for (let job of sorted) {
      if (clock < job.arrival) {
        gantt.push({ id: "IDLE", start: clock, end: job.arrival });
        clock = job.arrival;
      }
      gantt.push({ id: job.id, start: clock, end: clock + job.burst });
      clock += job.burst;
    }
    return gantt;
  }

  function runNPP() {
    let remaining = [...state.jobs];
    let ganttBlocks = [];
    let clock = 0, done = 0;

    while (done < state.jobs.length) {
      let available = remaining.filter(j => j.arrival <= clock);
      if (available.length === 0) {
        const nextArrival = Math.min(...remaining.map(j => j.arrival));
        ganttBlocks.push({ id: "IDLE", start: clock, end: nextArrival });
        clock = nextArrival;
        continue;
      }

      let best = available[0];
      for (let j of available) {
        if (j.priority < best.priority) best = j;
      }

      ganttBlocks.push({ id: best.id, start: clock, end: clock + best.burst });
      clock += best.burst;
      done++;
      remaining = remaining.filter(j => j.id !== best.id);
    }
    return ganttBlocks;
  }

  function runSJF() {
    let remaining = [...state.jobs];
    let ganttBlocks = [];
    let clock = 0, done = 0;

    while (done < state.jobs.length) {
      let available = remaining.filter(j => j.arrival <= clock);
      if (available.length === 0) {
        const nextArrival = Math.min(...remaining.map(j => j.arrival));
        ganttBlocks.push({ id: "IDLE", start: clock, end: nextArrival });
        clock = nextArrival;
        continue;
      }

      // Pick the job with the shortest burst time
      let best = available[0];
      for (let j of available) {
        if (j.burst < best.burst) {
          best = j;
        } 
        // TIE-BREAKER: If bursts are equal, the one that arrived first wins
        else if (j.burst === best.burst) {
          if (j.arrival < best.arrival) {
            best = j;
          }
        }
      }

      ganttBlocks.push({ id: best.id, start: clock, end: clock + best.burst });
      clock += best.burst;
      done++;
      remaining = remaining.filter(j => j.id !== best.id);
    }
    return ganttBlocks;
  }

  function runSRTF() {
    let tasks = state.jobs.map(j => ({...j, remaining: j.burst}));
    let ganttBlocks = [];
    let clock = 0, done = 0;

    while (done < tasks.length) {
      let available = tasks.filter(t => t.arrival <= clock && t.remaining > 0);
      
      if (available.length === 0) {
        const next = Math.min(...tasks.filter(t => t.remaining > 0).map(t => t.arrival));
        ganttBlocks.push({id:"IDLE", start:clock, end:next});
        clock = next;
        continue;
      }

      // TIE-BREAKER: Sort by remaining time, then by arrival time if equal
      available.sort((a, b) => {
        if (a.remaining !== b.remaining) {
          return a.remaining - b.remaining;
        }
        return a.arrival - b.arrival; 
      });
      
      const best = available[0];

      const nextArrivals = tasks.filter(t => t.arrival > clock && t.remaining > 0);
      const nextArrival = nextArrivals.length > 0 
        ? Math.min(...nextArrivals.map(t => t.arrival)) 
        : Infinity;
        
      const runTime = Math.min(best.remaining, nextArrival - clock);

      updateGanttBlock(ganttBlocks, best.id, clock, runTime);
      best.remaining -= runTime;
      clock += runTime;

      if (best.remaining === 0) done++;
    }
    return ganttBlocks;
  }


  // 9. RESULT CALCULATIONS & DISPLAY
  function calculateResults(ganttBlocks) {
    return state.jobs.map(job => {
      const myBlocks = ganttBlocks.filter(b => b.id === job.id);
      if (myBlocks.length === 0) return { id: job.id, completionTime: 0, tat: 0, wt: 0 };

      const completionTime = myBlocks[myBlocks.length - 1].end;
      const tat = completionTime - job.arrival;
      const wt = tat - job.burst;

      return { id: job.id, completionTime, tat, wt };
    });
  }

  function refreshResultAnimations() {
    document.querySelectorAll(".panel-content").forEach(p => {
      p.style.animation = 'none';
      void p.offsetHeight;
      p.style.animation = '';
    });
  }

  function displayGantt(ganttBlocks) {
    let firstTime = ganttBlocks[0].start;
    let totalTime = ganttBlocks[ganttBlocks.length - 1].end;
    let span      = totalTime - firstTime;

    let barsDiv   = document.getElementById("ganttBars");
    let labelsDiv = document.getElementById("burstLabels");
    let timeDiv   = document.getElementById("timeLabels");

    barsDiv.innerHTML = labelsDiv.innerHTML = timeDiv.innerHTML = "";

    for (let i = 0; i < ganttBlocks.length; i++) {
      let block    = ganttBlocks[i];
      let duration = block.end - block.start;
      let pct      = (duration / span) * 100 + "%";
      let isIdle   = block.id === "IDLE";

      let jobIndex = state.jobs.findIndex(j => j.id === block.id);
      let color    = isIdle ? "#2a2a2a" : getColor(jobIndex);
      let txtColor = isIdle ? "#666"    : "#111";

      // Burst label
      labelsDiv.innerHTML += `
        <div style="width: ${pct}; text-align: center; color: #f7e68a;">
          ${isIdle ? "" : duration}
        </div>`;

      // Bar
      barsDiv.innerHTML += `
        <div class="gantt-bar" style="width: ${pct}; background: ${color}; color: ${txtColor};
          border: ${isIdle ? "2px dashed #444" : "2px solid #111"};
          font-style: ${isIdle ? "italic" : "normal"};">
          ${block.id}
        </div>`;

      // Time labels
      timeDiv.innerHTML += `<div>${block.start}</div>`;
    }

    timeDiv.innerHTML += `<div class="end-time">${totalTime}</div>`;
  }

  function updateGanttBlock(ganttBlocks, id, start, duration) {
    if (ganttBlocks.length > 0 && ganttBlocks[ganttBlocks.length-1].id === id) {
      ganttBlocks[ganttBlocks.length-1].end += duration;
    } else {
      ganttBlocks.push({id, start, end: start + duration});
    }
  }

  function displayTAT(results) {
    let total = 0;
    let lines = "";

    for (let i = 0; i < results.length; i++) {
      let r       = results[i];
      let arrival = state.jobs[i].arrival;
      let color   = getColor(i);
      total      += r.tat;

      lines += `
        <div class="result-line" style="border-left: 4px solid ${color};">
          tt${i+1} = ${r.completionTime} - ${arrival} = <b>${r.tat}</b>
        </div>`;
    }

    let avg = (total / results.length).toFixed(2);

    document.getElementById("tatBox").innerHTML = `
      <div class="result-row">
        <div class="result-lines">${lines}</div>
        <div class="avg-box"><span>Avg TAT</span><b>${avg} ms</b></div>
      </div>`;
  }

  function displayWT(results) {
    let total = 0;
    let lines = "";

    for (let i = 0; i < results.length; i++) {
      let r     = results[i];
      let burst = state.jobs[i].burst;
      let color = getColor(i);
      total    += r.wt;

      lines += `
        <div class="result-line" style="border-left: 4px solid ${color};">
          wt${i+1} = ${r.tat} - ${burst} = <b>${r.wt}</b>
        </div>`;
    }

    let avg = (total / results.length).toFixed(2);

    document.getElementById("wtBox").innerHTML = `
      <div class="result-row">
        <div class="result-lines">${lines}</div>
        <div class="avg-box"><span>Avg WT</span><b>${avg} ms</b></div>
      </div>`;
  }

  function displayTimeline() {
    let html = `<div class="timeline-container">`;

    for (let i = 0; i < state.jobs.length; i++) {
      const color = getColor(i);
      const job = state.jobs[i];

      html += `
        <div class="timeline-item">
          <div class="timeline-dot" style="background: ${color}; border-color: var(--yellow);"></div>
          <div class="timeline-label" style="color: ${color};">${job.id}</div>
          <div class="timeline-time">${job.arrival}</div>
        </div>
      `;
    }

    html += `</div>`;
    document.getElementById("timelineBox").innerHTML = html;
  }

  function displayCPU(ganttBlocks) {
    let totalBurst = state.jobs.reduce((sum, j) => sum + j.burst, 0);
    let totalSpan = ganttBlocks[ganttBlocks.length - 1].end - ganttBlocks[0].start;
    
    let idleTime = ganttBlocks
      .filter(b => b.id === "IDLE")
      .reduce((sum, b) => sum + (b.end - b.start), 0);

    let burstParts = state.jobs.map(j => j.burst).join(" + ");
    let utilization = ((totalBurst / totalSpan) * 100).toFixed(0);

    document.getElementById("cpuBox").innerHTML = `
      <div class="cpu-display">
        <div>${burstParts}</div>
        <div class="cpu-line"></div>
        <div>${totalSpan}</div>
        <br>
        <div>${totalBurst} / ${totalSpan} = ${(totalBurst / totalSpan).toFixed(2)} × 100 = 
          <span class="cpu-result">${utilization}%</span>
        </div>
        <div class="red-separator"></div>
        <div class="idle-info">IDLE TIME: <b>${idleTime}</b> units</div>
      </div>`;
  }

  // 10. UTILITY FUNCTIONS
  function showError(msg) {
    const box = document.getElementById("errorMsg");
    box.textContent = "⚠ " + msg;
    box.style.display = "block";
  }

  function hideError() {
    document.getElementById("errorMsg").style.display = "none";
    document.querySelectorAll(".input-error").forEach(el => el.classList.remove("input-error"));
  }

  function resetApp() {
    state.jobs = [];
    state.nextJobId = 1;
    state.hasCalculated = false;

    document.getElementById("algorithm").value = "FCFS";

    ["tatBox","wtBox","timelineBox","cpuBox"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "Results will appear after calculation";
    });

    ["ganttBars","burstLabels","timeLabels"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });

    hideError();
    buildTable();
  }