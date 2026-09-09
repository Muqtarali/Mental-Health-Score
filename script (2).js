(() => {
  "use strict";

  const API_URL = "http://127.0.0.1:8000/predict";

  // The trained dataset's mental health score runs roughly 0–10.
  // Used only to animate the gauge ring; the raw number is always shown as-is.
  const GAUGE_MAX = 10;
  const GAUGE_CIRCUMFERENCE = 2 * Math.PI * 92; // matches r=92 in the SVG

  const form = document.getElementById("predictForm");
  const submitBtn = document.getElementById("submitBtn");
  const formError = document.getElementById("formError");
  const scoreValueEl = document.getElementById("scoreValue");
  const gaugeFill = document.getElementById("gaugeFill");
  const resultNote = document.getElementById("resultNote");
  const resultRail = document.getElementById("resultPanel");

  const usageInput = document.getElementById("avg_daily_usage_hours");
  const usageOut = document.getElementById("usageOut");

  usageInput.addEventListener("input", () => {
    usageOut.textContent = `${Number(usageInput.value).toFixed(1)} h`;
  });

  const NUMERIC_FIELDS = [
    { id: "age", type: "int", min: 1 },
    { id: "avg_daily_usage_hours", type: "float", min: 0, max: 24 },
    { id: "daily_unlocks", type: "int", min: 0 },
    { id: "study_hours", type: "float", min: 0 },
    { id: "physical_activity_hours", type: "float", min: 0 },
    { id: "sleep_hours_per_night", type: "float", min: 0 },
  ];

  const SELECT_FIELDS = [
    "gender",
    "academic_level",
    "most_used_platform",
    "purpose_of_use",
    "stress_level",
  ];

  function showError(message) {
    formError.textContent = message;
    formError.hidden = false;
  }

  function clearError() {
    formError.hidden = true;
    formError.textContent = "";
  }

  function validate(payloadRaw) {
    if (!payloadRaw.country || !payloadRaw.country.trim()) {
      return "Please enter a country.";
    }

    for (const field of SELECT_FIELDS) {
      if (!payloadRaw[field]) {
        return "Please fill in every field before submitting.";
      }
    }

    for (const spec of NUMERIC_FIELDS) {
      const raw = payloadRaw[spec.id];
      if (raw === "" || raw === null || raw === undefined || Number.isNaN(Number(raw))) {
        return "Please fill in every field with a valid number.";
      }
      const value = Number(raw);
      if (spec.type === "int" && !Number.isInteger(value)) {
        return `${labelFor(spec.id)} must be a whole number.`;
      }
      if (spec.min !== undefined && value < spec.min) {
        return `${labelFor(spec.id)} must be ${spec.min === 1 ? "greater than 0" : `${spec.min} or more`}.`;
      }
      if (spec.max !== undefined && value > spec.max) {
        return `${labelFor(spec.id)} can't be more than ${spec.max}.`;
      }
    }
    return null;
  }

  function labelFor(id) {
    const label = document.querySelector(`label[for="${id}"]`);
    return label ? label.textContent.replace(/\s*\d.*h$/, "").trim() : id;
  }

  function buildPayload() {
    const data = new FormData(form);
    return {
      age: Number(data.get("age")),
      gender: data.get("gender"),
      country: data.get("country").trim(),
      academic_level: data.get("academic_level"),
      most_used_platform: data.get("most_used_platform"),
      purpose_of_use: data.get("purpose_of_use"),
      avg_daily_usage_hours: Number(data.get("avg_daily_usage_hours")),
      daily_unlocks: Number(data.get("daily_unlocks")),
      study_hours: Number(data.get("study_hours")),
      physical_activity_hours: Number(data.get("physical_activity_hours")),
      sleep_hours_per_night: Number(data.get("sleep_hours_per_night")),
      stress_level: data.get("stress_level"),
    };
  }

  function setLoading(isLoading) {
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("loading", isLoading);
    if (isLoading) {
      resultNote.textContent = "Talking to the model…";
      resultNote.classList.remove("is-error");
    }
  }

  // Smoothly counts the displayed number up (or down) to the target value.
  function animateNumber(target, duration = 800) {
    const start = Number(scoreValueEl.dataset.raw || 0);
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (target - start) * eased;
      scoreValueEl.textContent = current.toFixed(2);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        scoreValueEl.textContent = target.toFixed(2);
        scoreValueEl.dataset.raw = String(target);
      }
    }
    requestAnimationFrame(tick);
  }

  function renderScore(score) {
    animateNumber(score);
    scoreValueEl.parentElement.classList.remove("pop");
    void scoreValueEl.parentElement.offsetWidth; // restart animation
    scoreValueEl.parentElement.classList.add("pop");

    const clamped = Math.max(0, Math.min(GAUGE_MAX, score));
    const fraction = clamped / GAUGE_MAX;
    const offset = GAUGE_CIRCUMFERENCE * (1 - fraction);
    gaugeFill.style.strokeDashoffset = String(offset);

    resultNote.textContent = "Based on today's inputs, run through the trained model.";
    resultNote.classList.remove("is-error");

    resultRail.classList.remove("just-updated");
    void resultRail.offsetWidth; // restart animation
    resultRail.classList.add("just-updated");
  }

  async function submitPrediction(payload) {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      let detail = `Server responded with status ${response.status}.`;
      try {
        const body = await response.json();
        if (body && body.detail) {
          detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
        }
      } catch (_) {
        /* response wasn't JSON — keep the generic message */
      }
      throw new Error(detail);
    }

    return response.json();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearError();

    const payload = buildPayload();
    const validationError = validate(payload);
    if (validationError) {
      showError(validationError);
      return;
    }

    setLoading(true);
    try {
      const result = await submitPrediction(payload);
      renderScore(Number(result.predicted_mental_health_score));
    } catch (err) {
      const isNetworkError = err instanceof TypeError;
      const message = isNetworkError
        ? "Couldn't reach the prediction server. Make sure the FastAPI backend is running at http://127.0.0.1:8000."
        : `Prediction failed: ${err.message}`;
      showError(message);
      resultNote.textContent = "Waiting for a valid response…";
      resultNote.classList.add("is-error");
    } finally {
      setLoading(false);
    }
  });
})();
