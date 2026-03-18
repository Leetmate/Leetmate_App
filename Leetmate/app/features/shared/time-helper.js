function getTodayString() {

  return new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Los_Angeles"
  });
}

function getTimestampString(){
	return new Date().toLocaleString("en-CA", {
    timeZone: "America/Los_Angeles"
  });
}