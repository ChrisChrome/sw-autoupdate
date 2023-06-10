const fs = require("fs");
const axios = require("axios");
const colors = require("colors")
const config = require("./config.json")
// setup function to use child process to run steamcmd
const { exec } = require("child_process");

const filter = (stdout) => {
	// Used to filter stdout of the following steamcmd command
	// steamcmd +force_install_dir ${config.install_dir} +login anonymous +app_info_status 1 +app_status ${config.app_id} +quit
	// Split the stdout by new line
	const lines = stdout.split("\n");
	// Filter the lines for the line containing "BuildID"
	const buildIDLine = lines.filter(line => line.includes("BuildID"))[0];
	// split by BuildID
	const buildID = buildIDLine.split("BuildID")[1].trim();
	// return the buildID
	return buildID;
}

const updateServer = async () => {
	clearInterval(updateCheck);
	exec(`steamcmd +force_install_dir ${config.install_dir} +login anonymous +app_update ${config.app_id} validate +quit`, (error, stdout, stderr) => {
		if (error | stderr) {
			console.log(`${colors.red("[Error]")} ${error.message}`);
			return;
		}
		console.log(stdout);
		exec(`steamcmd +force_install_dir ${config.install_dir} +login anonymous +app_update ${config.app_id} validate +quit`, (error, stdout, stderr) => { // Verify the update
			if (error | stderr) {
				console.log(`${colors.red("[Error]")} ${error.message}`);
				return;
			}
			console.log(stdout);
			if (config.after_update_command) {
				exec(config.after_update_command, (error, stdout, stderr) => { // Run the after update command
					if (error | stderr) {
						console.log(`${colors.red("[Error]")} ${error.message}`);
						return;
					}
					console.log(stdout);
					if (!config.force_update) {
						updateCheck = setInterval(() => {
							checkForUpdate();
						}, config.check_interval_mins * 60000)
					}
					console.log(`${colors.cyan("[Info]")} Operation completed at ${new Date().toLocaleString()}. Took Took ${((new Date() - startTime) / 1000).toFixed(2)} seconds.`)
				});
			}
		});
	});
}

const checkForUpdate = async () => {
	var startTime = new Date();
	console.log(`${colors.cyan("[Info]")} Operation started at ${startTime.toLocaleString()}`);
	console.log(`${colors.cyan("[Info]")} Checking for update...`);
	await axios.get(`https://api.steamcmd.net/v1/info/${config.app_id}`).then(async (response) => {
		await exec(`steamcmd +force_install_dir ${config.install_dir} +login anonymous +app_info_update 1 +app_status ${config.app_id} +quit`, (error, stdout, stderr) => {
			if (error) {
				console.log(`${colors.red("[Error]")} ${error.message}`);
				return;
			}
			if (stderr) {
				console.log(`${colors.red("[Error]")} ${stderr}`);
				return;
			}
			const buildID = filter(stdout);
			console.log(`${colors.cyan("[Info]")} Current BuildID: ${buildID}`);
			console.log(`${colors.cyan("[Info]")} Latest BuildID: ${response.data.data[config.app_id].depots.branches[config.check_branch].buildid}`);
			if (buildID !== response.data.data[config.app_id].depots.branches[config.check_branch].buildid || config.force_update) {
				console.log(`${colors.green("[Update]")} Update Available, updating...`);
				updateServer();

			} else {
				console.log(`${colors.green("[Update]")} No Update Available`);
				console.log(`${colors.cyan("[Info]")} Operation completed at ${new Date().toLocaleString()}. Took Took ${((new Date() - startTime) / 1000).toFixed(2)} seconds.`)
			}
		});
	})
}

checkForUpdate();

if (!config.force_update) {
	var updateCheck = setInterval(async () => {
		checkForUpdate();
	}, config.check_interval_mins * 60000)
}