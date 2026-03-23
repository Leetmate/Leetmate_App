const updateButton = document.getElementById('submit-updates');
updateButton.addEventListener('click', function () {
    message = document.getElementById('update-email').value;
    //alert(message);
    alert(storageGet("uid"));
});