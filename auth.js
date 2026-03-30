async function getAuthState() {
  const response = await fetch("/api/me", {
    credentials: "include"
  });
  return response.json();
}

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutButton = document.getElementById("logoutButton");

if (loginForm) {
  getAuthState().then((data) => {
    if (data.authenticated) {
      window.location.href = "/admin.html";
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    if (response.ok && data.ok) {
      window.location.href = "/admin.html";
      return;
    }

    loginMessage.textContent = data.message || "Login failed.";
  });
}

if (logoutButton) {
  getAuthState().then((data) => {
    if (!data.authenticated) {
      window.location.href = "/login.html";
    }
  });

  logoutButton.addEventListener("click", async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include"
    });
    window.location.href = "/login.html";
  });
}
