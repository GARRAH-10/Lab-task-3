const cityInput = document.getElementById("cityInput");
const searchBtn = document.getElementById("searchBtn");
const validationMessage = document.getElementById("validationMessage");
const errorBanner = document.getElementById("errorBanner");

const cityNameEl = document.getElementById("cityName");
const temperatureEl = document.getElementById("temperature");
const descriptionEl = document.getElementById("description");
const humidityEl = document.getElementById("humidity");
const windEl = document.getElementById("wind");
const timeEl = document.getElementById("time");
const forecastRow = document.getElementById("forecastRow");

let lastSearchedCity = "";
let debounceTimer;

function createForecastSkeletons() {
  forecastRow.innerHTML = "";
  for (let i = 0; i < 7; i++) {
    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <p class="skeleton">Day</p>
      <p class="skeleton">Icon</p>
      <p class="skeleton">High/Low</p>
    `;
    forecastRow.appendChild(card);
  }
}

createForecastSkeletons();

const weatherLookup = {
  0: { desc: "Clear sky", icon: "☀️" },
  1: { desc: "Mainly clear", icon: "🌤️" },
  2: { desc: "Partly cloudy", icon: "⛅" },
  3: { desc: "Overcast", icon: "☁️" },
  45: { desc: "Fog", icon: "🌫️" },
  48: { desc: "Depositing rime fog", icon: "🌫️" },
  51: { desc: "Light drizzle", icon: "🌦️" },
  53: { desc: "Moderate drizzle", icon: "🌦️" },
  55: { desc: "Dense drizzle", icon: "🌧️" },
  56: { desc: "Light freezing drizzle", icon: "🌧️" },
  57: { desc: "Dense freezing drizzle", icon: "🌧️" },
  61: { desc: "Slight rain", icon: "🌦️" },
  63: { desc: "Moderate rain", icon: "🌧️" },
  65: { desc: "Heavy rain", icon: "🌧️" },
  66: { desc: "Light freezing rain", icon: "🌧️" },
  67: { desc: "Heavy freezing rain", icon: "🌧️" },
  71: { desc: "Slight snow", icon: "🌨️" },
  73: { desc: "Moderate snow", icon: "❄️" },
  75: { desc: "Heavy snow", icon: "❄️" },
  77: { desc: "Snow grains", icon: "❄️" },
  80: { desc: "Slight rain showers", icon: "🌦️" },
  81: { desc: "Moderate rain showers", icon: "🌧️" },
  82: { desc: "Violent rain showers", icon: "⛈️" },
  85: { desc: "Slight snow showers", icon: "🌨️" },
  86: { desc: "Heavy snow showers", icon: "❄️" },
  95: { desc: "Thunderstorm", icon: "⛈️" },
  96: { desc: "Thunderstorm with slight hail", icon: "⛈️" },
  99: { desc: "Thunderstorm with heavy hail", icon: "⛈️" }
};

function showSkeletons() {
  [cityNameEl, temperatureEl, descriptionEl, humidityEl, windEl, timeEl].forEach(el => {
    el.classList.add("skeleton");
    el.textContent = "Loading...";
  });
  createForecastSkeletons();
}

function removeSkeletons() {
  [cityNameEl, temperatureEl, descriptionEl, humidityEl, windEl, timeEl].forEach(el => {
    el.classList.remove("skeleton");
  });
}

function showError(message, retry = false) {
  errorBanner.classList.remove("hidden");
  errorBanner.innerHTML = retry
    ? `${message} <button id="retryBtn">Retry</button>`
    : message;

  if (retry) {
    document.getElementById("retryBtn").addEventListener("click", () => {
      if (lastSearchedCity) {
        fetchWeather(lastSearchedCity);
      }
    });
  }
}

function hideError() {
  errorBanner.classList.add("hidden");
  errorBanner.innerHTML = "";
}

function getDayName(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", { weekday: "short" });
}

function getClosestHourIndex(hourlyTimes, currentTime) {
  const targetTime = new Date(currentTime).getTime();
  let closestIndex = 0;
  let smallestDiff = Infinity;

  hourlyTimes.forEach((time, index) => {
    const diff = Math.abs(new Date(time).getTime() - targetTime);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      closestIndex = index;
    }
  });

  return closestIndex;
}

async function fetchWeather(city) {
  validationMessage.textContent = "";
  hideError();
  showSkeletons();
  lastSearchedCity = city;

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`;
    const geoResponse = await fetchWithTimeout(geoUrl);

    if (!geoResponse.ok) {
      throw new Error(`Geocoding HTTP error: ${geoResponse.status}`);
    }

    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      removeSkeletons();
      showError("City not found. Please enter a valid city name.");
      return;
    }

    const place = geoData.results[0];
    const { latitude, longitude, name, country, timezone } = place;
    const fullCityName = country ? `${name}, ${country}` : name;

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&current_weather=true` +
      `&hourly=temperature_2m,relativehumidity_2m,windspeed_10m` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
      `&timezone=auto`;

    const weatherResponse = await fetchWithTimeout(weatherUrl);

    if (!weatherResponse.ok) {
      throw new Error(`Weather HTTP error: ${weatherResponse.status}`);
    }

    const weatherData = await weatherResponse.json();
    displayWeather(fullCityName, timezone, weatherData);
    fetchLocalTime(timezone);

  } catch (error) {
    removeSkeletons();

    if (error.name === "AbortError") {
      showError("Request timed out after 10 seconds.", true);
    } else {
      showError(`Network/API error: ${error.message}`, true);
    }
  }
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function displayWeather(city, timezone, data) {
  removeSkeletons();

  const current = data.current_weather;
  const codeInfo = weatherLookup[current.weathercode] || { desc: "Unknown", icon: "❔" };

  cityNameEl.textContent = city;
  temperatureEl.textContent = `Temperature: ${current.temperature}°C`;
  descriptionEl.textContent = `${codeInfo.icon} ${codeInfo.desc}`;

  const currentHourIndex = getClosestHourIndex(data.hourly.time, current.time);
  const humidityValue = data.hourly.relativehumidity_2m[currentHourIndex];

  humidityEl.textContent = `Humidity: ${humidityValue}%`;
  windEl.textContent = `Wind Speed: ${current.windspeed} km/h`;
  timeEl.textContent = "Local Time: Loading...";

  forecastRow.innerHTML = "";

  for (let i = 0; i < 7; i++) {
    const forecastCode = data.daily.weathercode[i];
    const info = weatherLookup[forecastCode] || { desc: "Unknown", icon: "❔" };

    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <h3>${getDayName(data.daily.time[i])}</h3>
      <p style="font-size: 28px;">${info.icon}</p>
      <p>${data.daily.temperature_2m_max[i]}° / ${data.daily.temperature_2m_min[i]}°</p>
    `;
    forecastRow.appendChild(card);
  }
}

function fetchLocalTime(timezone) {
  if (!timezone) {
    timeEl.textContent = `Local Time: ${new Date().toLocaleString()}`;
    return;
  }

  $.getJSON(`https://worldtimeapi.org/api/timezone/${timezone}`)
    .done(function (timeData) {
      const localTime = new Date(timeData.datetime).toLocaleString();
      timeEl.textContent = `Local Time: ${localTime}`;
    })
    .fail(function () {
      timeEl.textContent = `Local Time: ${new Date().toLocaleString()}`;
    })
    .always(function () {
      console.log("Time request completed at:", new Date().toLocaleString());
    });
}

function handleSearch() {
  const city = cityInput.value.trim();

  if (city.length < 2) {
    validationMessage.textContent = "Please enter at least 2 characters.";
    return;
  }

  fetchWeather(city);
}

searchBtn.addEventListener("click", handleSearch);

cityInput.addEventListener("keydown", function (e) {
  if (e.key === "Enter") {
    handleSearch();
  }
});

cityInput.addEventListener("input", function () {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    const city = cityInput.value.trim();
    if (city.length >= 2) {
      fetchWeather(city);
    }
  }, 500);
});