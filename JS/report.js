var CONFIG = {
    API_BASE: "https://hxmktiw3u3.execute-api.ap-southeast-2.amazonaws.com/test",
    COGNITO_CLIENT_ID: "5uuc4i1j8d6a0jd3dbavprgsq9",
    COGNITO_ENDPOINT: "https://cognito-idp.ap-southeast-2.amazonaws.com/"
};

function decodeIdTokenPayload(idToken) {
    try {
        var payloadPart = idToken.split(".")[1];
        var decoded = atob(payloadPart.replace(/-/g, "+").replace(/_/g, "/"));
        return JSON.parse(decoded);
    } catch (e) {
        return null;
    }
}

function saveSession(authResult, fallbackName) {
    var payload = decodeIdTokenPayload(authResult.IdToken);
    var sessionUser = {
        email: payload && payload.email ? payload.email : fallbackName,
        name: payload && payload.name ? payload.name : fallbackName,
        idToken: authResult.IdToken,
        accessToken: authResult.AccessToken
    };
    localStorage.setItem("snapfix_session", JSON.stringify(sessionUser));
}

function getCurrentUser() {
    var raw = localStorage.getItem("snapfix_session");
    if (raw == null) return null;
    return JSON.parse(raw);
}

function checkLogin() {
    var user = getCurrentUser();
    if (user == null) {
        location.href = "login.html";
    }
    return user;
}

function loginUser() {
    var email = document.getElementById("email_tb").value;
    var password = document.getElementById("password_tb").value;
    if (email === "" || password === "") {
        alert("Please enter your email and password.");
        return;
    }

    fetch(CONFIG.COGNITO_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth"
        },
        body: JSON.stringify({
            AuthFlow: "USER_PASSWORD_AUTH",
            ClientId: CONFIG.COGNITO_CLIENT_ID,
            AuthParameters: { USERNAME: email, PASSWORD: password }
        })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        if (data.AuthenticationResult == null) {
            if (data.__type === "UserNotConfirmedException") {
                alert("This account hasn't been confirmed yet. Please check your email for the confirmation code.");
                pendingEmail = email;
                pendingPassword = password;
                showConfirmStepFromLogin();
                return;
            }
            alert("Login failed: " + (data.message || data.__type || "Unknown error"));
            return;
        }
        saveSession(data.AuthenticationResult, email.split("@")[0]);
        location.href = "my-reports.html";
    })
    .catch(function (err) {
        alert("Login failed: " + err);
    });
}

var pendingEmail = null;
var pendingPassword = null;
var pendingName = null;

function registerUser() {
    var name = document.getElementById("name_tb").value;
    var email = document.getElementById("email_tb").value;
    var password = document.getElementById("password_tb").value;
    var confirm = document.getElementById("confirm_tb").value;

    if (name === "" || email === "" || password === "") {
        alert("Please fill in all fields.");
        return;
    }
    if (password !== confirm) {
        alert("Passwords do not match.");
        return;
    }
    if (password.length < 6) {
        alert("Password should be at least 6 characters.");
        return;
    }

    fetch(CONFIG.COGNITO_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.SignUp"
        },
        body: JSON.stringify({
            ClientId: CONFIG.COGNITO_CLIENT_ID,
            Username: email,
            Password: password,
            UserAttributes: [{ Name: "name", Value: name }, { Name: "email", Value: email }]
        })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        if (data.__type) {
            alert("Could not create account: " + (data.message || data.__type));
            return;
        }
        pendingEmail = email;
        pendingPassword = password;
        pendingName = name;

        if (data.UserConfirmed === true) {
            alert("Account created! You can now log in.");
            location.href = "login.html";
            return;
        }

        alert("Account created! Check your email for a confirmation code.");
        document.getElementById("registerForm").style.display = "none";
        document.getElementById("confirmSection").style.display = "block";
    })
    .catch(function (err) {
        alert("Could not create account: " + err);
    });
}

function confirmRegistration() {
    var code = document.getElementById("code_tb").value;
    if (code === "") {
        alert("Please enter the confirmation code.");
        return;
    }

    fetch(CONFIG.COGNITO_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmSignUp"
        },
        body: JSON.stringify({
            ClientId: CONFIG.COGNITO_CLIENT_ID,
            Username: pendingEmail,
            ConfirmationCode: code
        })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        if (data.__type) {
            alert("Could not confirm account: " + (data.message || data.__type));
            return;
        }
        alert("Account confirmed! You can now log in.");
        location.href = "login.html";
    })
    .catch(function (err) {
        alert("Could not confirm account: " + err);
    });
}

function showConfirmStepFromLogin() {
    var loginCard = document.querySelector(".login-card");
    if (loginCard == null) return;
    var codeInput = prompt("Enter the confirmation code sent to your email:");
    if (codeInput == null || codeInput === "") return;

    fetch(CONFIG.COGNITO_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "AWSCognitoIdentityProviderService.ConfirmSignUp"
        },
        body: JSON.stringify({
            ClientId: CONFIG.COGNITO_CLIENT_ID,
            Username: pendingEmail,
            ConfirmationCode: codeInput
        })
    })
    .then(function (res) { return res.json(); })
    .then(function (data) {
        if (data.__type) {
            alert("Could not confirm account: " + (data.message || data.__type));
            return;
        }
        alert("Account confirmed! Please log in again.");
    })
    .catch(function (err) {
        alert("Could not confirm account: " + err);
    });
}

function logoutUser() {
    localStorage.removeItem("snapfix_session");
    location.href = "login.html";
}

function fetchAllReports(onSuccess) {
    fetch(CONFIG.API_BASE + "/reports")
    .then(function (res) { return res.json(); })
    .then(function (data) {
        onSuccess(data);
    })
    .catch(function (err) {
        alert("Could not load reports: " + err);
    });
}

function loadMyReports() {
    var currentUser = checkLogin();
    if (currentUser == null) return;

    fetchAllReports(function (allReports) {
        var myReports = [];
        for (var i = 0; i < allReports.length; i++) {
            if (allReports[i].reported_by === currentUser.email) {
                myReports.push(allReports[i]);
            }
        }
        insertDynamicReports(myReports, false);
    });
}

function loadAllReports() {
    fetchAllReports(function (allReports) {
        insertDynamicReports(allReports, true);
    });
}

function loadHomepageReports() {
    fetchAllReports(function (allReports) {
        insertHomepageReports(allReports);
    });
}

function insertHomepageReports(arrayOfReports) {
    var listContainer = document.getElementById("homeReportList");
    if (listContainer == null) return;
    if (arrayOfReports.length === 0) {
        listContainer.innerHTML = "<p class='empty-msg'>No reports yet - be the first to report an issue!</p>";
        return;
    }

    var newContent = "<table class='list-table'><tr>";
    for (var i = 0; i < arrayOfReports.length; i++) {
        var r = arrayOfReports[i];

        newContent +=
            "<td>" +
                "<img src='" + r.image_path + "' onerror=\"this.src='assets/no-image.svg'\">" +
                "<h4>" + r.title + "</h4>" +
                "<span class='status-pill status-" + r.status + "'>" + humanizeStatus(r.status) + "</span>" +
                "<p><b>Location:</b> " + r.location + "</p>" +
                "<p><b>Category:</b> " + r.category + "</p>" +
                "<p><b>Submitted:</b> " + r.created_at + "</p>" +
                "<div class='btn-row'>" +
                    "<button type='button' onclick='viewReport(this)' reportId='" + r.id + "'>View Report</button>" +
                "</div>" +
            "</td>";

        if ((i + 1) % 3 === 0 && i < arrayOfReports.length - 1) {
            newContent += "</tr><tr>";
        }
    }
    newContent += "</tr></table>";
    listContainer.innerHTML = newContent;
}

function insertDynamicReports(arrayOfReports, isAdminView) {
    var listContainer = document.getElementById("dynamicReportList");
    if (arrayOfReports.length === 0) {
        listContainer.innerHTML = "<p class='empty-msg'>No reports found.</p>";
        return;
    }

    var newContent = "<table class='list-table'><tr>";
    for (var i = 0; i < arrayOfReports.length; i++) {
        var r = arrayOfReports[i];
        newContent +=
            "<td>" +
                "<img src='" + r.image_path + "' onerror=\"this.src='assets/no-image.svg'\">" +
                "<h4>" + r.title + "</h4>" +
                "<span class='status-pill status-" + r.status + "'>" + humanizeStatus(r.status) + "</span>" +
                "<p><b>Location:</b> " + r.location + "</p>" +
                "<p><b>Category:</b> " + r.category + "</p>" +
                (isAdminView ? "<p><b>Reported by:</b> " + r.reported_by + "</p>" : "") +
                "<p><b>Submitted:</b> " + r.created_at + "</p>" +
                "<div class='btn-row'>" +
                    "<button type='button' onclick='viewReport(this)' reportId='" + r.id + "'>View" + (isAdminView ? " / Update" : "") + "</button>" +
                    "<button type='button' class='delete' onclick='deleteReportData(this)' reportId='" + r.id + "'>Delete</button>" +
                "</div>" +
            "</td>";
        if ((i + 1) % 3 === 0 && i < arrayOfReports.length - 1) {
            newContent += "</tr><tr>";
        }
    }
    newContent += "</tr></table>";
    listContainer.innerHTML = newContent;
}

function humanizeStatus(status) {
    if (status === "in_progress") return "In Progress";
    if (status === "pending") return "Pending";
    if (status === "resolved") return "Resolved";
    if (status === "rejected") return "Rejected";
    return status;
}

function viewReport(buttonElement) {
    var id = buttonElement.getAttribute("reportId");
    location.href = "report-detail.html?id=" + id;
}

function deleteReportData(buttonElement) {
    var confirmDelete = confirm("Are you sure you want to delete this report?");
    if (!confirmDelete) return;

    var id = buttonElement.getAttribute("reportId");
    fetch(CONFIG.API_BASE + "/reports/" + id, { method: "DELETE" })
    .then(function (res) { return res.json(); })
    .then(function () {
        location.reload();
    })
    .catch(function (err) {
        alert("Could not delete report: " + err);
    });
}

function searchReports(isAdminView) {
    var titleQuery = document.getElementById("searchTitle").value.toLowerCase();
    var statusQuery = document.getElementById("searchStatus").value;
    var currentUser = getCurrentUser();

    fetchAllReports(function (allReports) {
        var filtered = [];
        for (var i = 0; i < allReports.length; i++) {
            var r = allReports[i];
            if (!isAdminView && r.reported_by !== currentUser.email) continue;
            if (titleQuery !== "" && r.title.toLowerCase().indexOf(titleQuery) === -1) continue;
            if (statusQuery !== "" && r.status !== statusQuery) continue;

            filtered.push(r);
        }
        insertDynamicReports(filtered, isAdminView);
    });
}

var currentReportId = null;

function loadReportDetail() {
    var params = new URLSearchParams(location.search);
    var id = params.get("id");
    if (id == null) {
        alert("No report id found in URL!");
        return;
    }
    currentReportId = id;

    fetch(CONFIG.API_BASE + "/reports/" + id)
    .then(function (res) { return res.json(); })
    .then(function (found) {
        if (found == null || found.id == null) {
            alert("Report not found.");
            return;
        }
        setReportDetailInfo(found);
    })
    .catch(function (err) {
        alert("Could not load report: " + err);
    });
}

function setReportDetailInfo(report) {
    document.getElementById("reportTitle").innerHTML = report.title;
    document.getElementById("mainImage").src = report.image_path;
    document.getElementById("location").innerHTML = report.location;
    document.getElementById("category").innerHTML = report.category;
    document.getElementById("description").innerHTML = report.description;
    document.getElementById("reportedBy").innerHTML = report.reported_by;
    document.getElementById("createdAt").innerHTML = report.created_at;

    var statusEl = document.getElementById("statusPill");
    statusEl.innerHTML = humanizeStatus(report.status);
    statusEl.className = "status-pill status-" + report.status;

    var statusDropdown = document.getElementById("status_tb");
    if (statusDropdown != null) {
        statusDropdown.value = report.status;
    }

    var tagsHtml = "";
    var labels = report.detected_labels ? report.detected_labels.split(",") : [];
    for (var i = 0; i < labels.length; i++) {
        tagsHtml += "<span>" + labels[i].trim() + "</span>";
    }
    document.getElementById("tagList").innerHTML = tagsHtml || "No labels recorded.";
}

function deleteThisReport() {
    var confirmDelete = confirm("Are you sure you want to delete this report?");
    if (!confirmDelete) return;

    fetch(CONFIG.API_BASE + "/reports/" + currentReportId, { method: "DELETE" })
    .then(function (res) { return res.json(); })
    .then(function () {
        alert("Report deleted.");
        location.href = "my-reports.html";
    })
    .catch(function (err) {
        alert("Could not delete report: " + err);
    });
}

function goBackToList() {
    history.back();
}

var selectedImageData = null;
var lastDetectedLabels = "";

function previewImage() {
    var fileInput = document.getElementById("image_tb");
    var file = fileInput.files[0];
    if (file == null) return;

    var reader = new FileReader();
    reader.onload = function (event) {
        resizeImageData(event.target.result, function (resizedData) {
            selectedImageData = resizedData;
            var previewEl = document.getElementById("previewImg");
            previewEl.src = selectedImageData;
            previewEl.style.display = "block";
            document.getElementById("analysisBox").style.display = "none";
        });
    };
    reader.readAsDataURL(file);
}

function resizeImageData(dataUrl, onDone) {
    var img = new Image();
    img.onload = function () {
        var maxWidth = 900;
        var scale = img.width > maxWidth ? maxWidth / img.width : 1;
        var canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onDone(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = function () {
        onDone(dataUrl);
    };
    img.src = dataUrl;
}

function analyzeImageNow() {
    if (selectedImageData == null) {
        alert("Please upload a photo first.");
        return;
    }

    fetch(CONFIG.API_BASE + "/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: selectedImageData })
    })
    .then(function (res) {
        if (!res.ok) throw new Error("Rekognition endpoint not available yet");
        return res.json();
    })
    .then(function (data) {
        showDetectionResult(data.category, data.labels);
    })
    .catch(function (err) {
        alert("AWS Rekognition analysis isn't connected yet - please select a category manually.");
    });
}

function showDetectionResult(category, labels) {
    lastDetectedLabels = labels;

    var box = document.getElementById("analysisBox");
    box.innerHTML = "<b>AWS Rekognition detected:</b><br>" + labels;
    box.style.display = "block";

    var categorySelect = document.getElementById("category_tb");
    if (categorySelect.value === "") {
        categorySelect.value = category;
    }
}

function submitNewReport() {
    var currentUser = checkLogin();
    if (currentUser == null) return;

    var title = document.getElementById("title_tb").value;
    var location_val = document.getElementById("location_tb").value;
    var category = document.getElementById("category_tb").value;
    var description = document.getElementById("description_tb").value;

    if (title === "" || location_val === "" || category === "" || description === "") {
        alert("Please fill in all fields.");
        return;
    }
    if (selectedImageData == null) {
        alert("Please upload a photo of the damage.");
        return;
    }

    var newReport = {
        reported_by: currentUser.email,
        title: title,
        location: location_val,
        category: category,
        description: description,
        image_path: selectedImageData,
        detected_labels: lastDetectedLabels
    };

    fetch(CONFIG.API_BASE + "/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newReport)
    })
    .then(function (res) { return res.json(); })
    .then(function () {
        alert("Report submitted!");
        location.href = "my-reports.html";
    })
    .catch(function (err) {
        alert("Could not submit report: " + err);
    });
}

function updateReportStatus() {
    var id = currentReportId;
    var newStatus = document.getElementById("status_tb").value;

    fetch(CONFIG.API_BASE + "/reports/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
    })
    .then(function (res) { return res.json(); })
    .then(function () {
        alert("Status updated.");
        location.reload();
    })
    .catch(function (err) {
        alert("Could not update status: " + err);
    });
}

function updateNavForLoginState() {
    var user = getCurrentUser();
    var navUserSlot = document.getElementById("navUserSlot");
    if (navUserSlot == null) return;

    if (user == null) {
        navUserSlot.innerHTML = "<a href='login.html'>Log In</a><a href='register.html'>Sign Up</a>";
    } else {
        navUserSlot.innerHTML =
            "<a href='my-reports.html'>" + user.name + "</a>" +
            "<a href='#' onclick='logoutUser(); return false;'>Log Out</a>";
    }
}