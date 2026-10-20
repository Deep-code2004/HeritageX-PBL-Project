document.addEventListener("DOMContentLoaded", async () => {
    const loginForm = document.getElementById("loginForm");
    const registerForm = document.getElementById("registerForm");
    const forms = document.getElementById("accountForms");
    const session = document.getElementById("accountSession");
    const message = document.getElementById("accountMessage");

    function showMessage(text, isError = false) {
        message.textContent = text;
        message.className = `mt-3 small ${isError ? "text-danger" : "text-success"}`;
    }

    function returnTarget() {
        const value = new URLSearchParams(window.location.search).get("returnTo");
        if (!value) return "explore.html";
        try {
            const target = new URL(value, window.location.origin);
            if (target.origin === window.location.origin && target.pathname !== "/Pages/account.html") {
                return `${target.pathname}${target.search}${target.hash}`;
            }
        } catch {
            return "explore.html";
        }
        return "explore.html";
    }

    function setBusy(form, busy) {
        form.querySelector('[type="submit"]').disabled = busy;
    }

    function showSession(user) {
        if (!user) return;
        forms.classList.add("d-none");
        session.classList.remove("d-none");
        document.getElementById("accountIdentity").textContent = `${user.name} · ${user.email}`;
    }

    document.getElementById("showLoginBtn").addEventListener("click", (event) => {
        loginForm.classList.remove("d-none");
        registerForm.classList.add("d-none");
        event.currentTarget.className = "btn btn-maroon";
        event.currentTarget.setAttribute("aria-pressed", "true");
        const register = document.getElementById("showRegisterBtn");
        register.className = "btn btn-outline-maroon";
        register.setAttribute("aria-pressed", "false");
    });
    document.getElementById("showRegisterBtn").addEventListener("click", (event) => {
        registerForm.classList.remove("d-none");
        loginForm.classList.add("d-none");
        event.currentTarget.className = "btn btn-maroon";
        event.currentTarget.setAttribute("aria-pressed", "true");
        const login = document.getElementById("showLoginBtn");
        login.className = "btn btn-outline-maroon";
        login.setAttribute("aria-pressed", "false");
    });

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setBusy(loginForm, true);
        showMessage("Signing you in…");
        try {
            const result = await api.post("/auth/login", {
                emailOrUsername: document.getElementById("loginIdentity").value.trim(),
                password: document.getElementById("loginPassword").value
            });
            api.setCurrentUser(result.user);
            try {
                await hxMigrateGuestData();
            } catch (error) {
                showMessage(`${error.message} Your guest data remains on this device.`, true);
            }
            window.location.assign(returnTarget());
        } catch (error) {
            showMessage(error.message || "Sign-in failed. Check your details and try again.", true);
        } finally {
            setBusy(loginForm, false);
        }
    });

    registerForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        setBusy(registerForm, true);
        showMessage("Creating your account…");
        try {
            const result = await api.post("/auth/register", {
                name: document.getElementById("registerName").value.trim(),
                email: document.getElementById("registerEmail").value.trim(),
                password: document.getElementById("registerPassword").value
            });
            api.setCurrentUser(result.user);
            try {
                await hxMigrateGuestData();
            } catch (error) {
                showMessage(`${error.message} Your guest data remains on this device.`, true);
            }
            window.location.assign(returnTarget());
        } catch (error) {
            showMessage(error.message || "Account creation failed. Please try again.", true);
        } finally {
            setBusy(registerForm, false);
        }
    });

    document.getElementById("logoutBtn").addEventListener("click", async (event) => {
        const button = event.currentTarget;
        button.disabled = true;
        try {
            await api.post("/auth/logout", {});
            api.setCurrentUser(null);
            session.classList.add("d-none");
            forms.classList.remove("d-none");
            showMessage("You have signed out.");
        } catch (error) {
            showMessage(error.message || "Sign-out failed. Please try again.", true);
        } finally {
            button.disabled = false;
        }
    });

    const user = await (window.hxAuthReady || Promise.resolve(window.HX_AUTH_USER));
    if (user) showSession(user);
});
