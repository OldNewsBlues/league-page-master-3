import { getLeagueData } from './leagueData';
import { leagueID, managers } from '$lib/utils/leagueInfo';
import { getNflState } from './nflState';
import { getLeagueRosters } from "./leagueRosters"
import { getLeagueUsers } from "./leagueUsers"
import { waitForAll } from './multiPromise';
import { get } from 'svelte/store';
import {records} from '$lib/stores';
import { loadPlayers } from '$lib/utils/helper';

export const getLeagueRecords = async (refresh = false) => {
	if(get(records).seasonWeekRecords) {
		return get(records);
	}

	// if this isn't a refresh data call, check if there are already transactions stored in localStorage
	if(!refresh) {
		let localRecords = await JSON.parse(localStorage.getItem("records"));
		// check if transactions have been saved to localStorage before
		if(localRecords) {
			localRecords.stale = true;
			return localRecords;
		}
	}

	const playersData = await loadPlayers().catch((err) => { console.error(err); });;
	const playersInfo = playersData.players;

	const nflState = await getNflState().catch((err) => { console.error(err); });
	let week = 0;
	if(nflState.season_type == 'regular') {
		week = nflState.week - 1;
	} else if(nflState.season_type == 'post') {
		week = 18;
	}

	let curSeason = leagueID;

	let currentManagers;
	
	let currentYear;
	let lastYear;

	let allTimeMatchupDifferentials = [];

	let leagueRosterRecords = {}; // every full season stat point (for each year and all years combined)
	let seasonWeekRecords = []; // highest weekly points within a single season
	let leagueWeekRecords = []; // highest weekly points within a single season
	let leagueWeekLows = []; // lowest weekly points within a single season
	let mostSeasonLongPoints = []; // 10 highest full season points
	let leastSeasonLongPoints = []; // 10 lowest full season points
	let allTimeBiggestBlowouts = []; // 10 biggest blowouts
	let allTimeClosestMatchups = []; // 10 closest matchups
	let individualWeekRecords = {}; // weekly scores/matchup data indexed by rosterID
	let allTimeWeekBests = []; // each rosterID's highest scoring week
	let allTimeWeekWorsts = []; // each rosterID's lowest scoring week
	let allTimeSeasonBests = []; // each rosterID's highest scoring season
	let allTimeSeasonWorsts = []; // each rosterID's lowest scoring season
	let allTimeEPERecords = [];
	let leagueManagers = {};
	let activeManagers = [];
	let playerRecords = {};

	for(const managerID in managers) {
		const manager = managers[managerID];

		const entryMan = {
			managerID: manager.managerID,
			rosterID: manager.roster,
			name: manager.name,
			status: manager.status,
			yearsactive: manager.yearsactive,
		}

		if(!leagueManagers[manager.roster]) {
			leagueManagers[manager.roster] = [];
		}
		leagueManagers[manager.roster].push(entryMan);

		if(manager.status == "active") {
			activeManagers.push(manager.managerID);
		}
	}

	while(curSeason && curSeason != 0) {
		const [rosterRes, users, leagueData] = await waitForAll(
			getLeagueRosters(curSeason),
			getLeagueUsers(curSeason),
			getLeagueData(curSeason),
		).catch((err) => { console.error(err); });
	
		let year = parseInt(leagueData.season);

		// on first run, week is provided above from nflState,
		// after that get the final week of regular season from leagueData
		if(leagueData.status == 'complete' || week > leagueData.settings.playoff_week_start - 1) {
			week = leagueData.settings.playoff_week_start - 1;
		}

		lastYear = year;
	
		const rosters = rosterRes.rosters;
	
		const originalManagers = {};
	
		for(const roster of rosters) {
			const rosterID = roster.roster_id;
			const user = users[roster.owner_id];
			
			let recordManager = leagueManagers[rosterID].filter(m => m.yearsactive.includes(year));
			let recordManID = recordManager[0].managerID;

			if(user) {
				originalManagers[recordManID] = {
					avatar: `https://sleepercdn.com/avatars/thumbs/${user.avatar}`,
					name: user.metadata.team_name ? user.metadata.team_name : user.display_name,
					realname: recordManager[0].name,
				};
			} else {
				originalManagers[recordManID] = {
					avatar: `https://sleepercdn.com/images/v2/icons/player_default.webp`,
					name: 'Unknown Manager',
					realname: 'John Q. Rando',
				};
			}

			if(roster.settings.wins == 0 && roster.settings.ties == 0 && roster.settings.losses == 0) continue;

			if(!leagueRosterRecords[recordManID]) {
				leagueRosterRecords[recordManID] = {
					wins: 0,
					losses: 0,
					ties: 0,
					fptsFor: 0,
					fptsAgainst: 0,
					potentialPoints: 0,
					fptspg: 0,
					manager: originalManagers[recordManID],
					years: [],
				}
			}

			const fpts = roster.settings.fpts + (roster.settings.fpts_decimal / 100);
			const fptsAgainst = roster.settings.fpts_against + (roster.settings.fpts_against_decimal / 100);
			const potentialPoints = roster.settings.ppts + (roster.settings.ppts_decimal / 100);
			const fptspg = roster.settings.fpts / (roster.settings.wins + roster.settings.losses + roster.settings.ties);

			// add records to league roster record record
			leagueRosterRecords[recordManID].wins += roster.settings.wins;
			leagueRosterRecords[recordManID].losses += roster.settings.losses;
			leagueRosterRecords[recordManID].ties += roster.settings.ties;
			leagueRosterRecords[recordManID].fptsFor += fpts;
			leagueRosterRecords[recordManID].fptsAgainst += fptsAgainst;
			leagueRosterRecords[recordManID].potentialPoints += potentialPoints;
			leagueRosterRecords[recordManID].fptspg += fptspg;
			

			// add singleSeason info [`${year}fptsFor`]
			const singleYearInfo = {
				wins: roster.settings.wins,
				losses: roster.settings.losses,
				ties: roster.settings.ties,
				fpts,
				fptsAgainst,
				potentialPoints,
				fptspg,
				manager: originalManagers[recordManID],
				year,
				recordManID,
			}

			leagueRosterRecords[recordManID].years.push(singleYearInfo);

			mostSeasonLongPoints.push({
				recordManID,
				fpts,
				fptspg,
				year,
				manager: originalManagers[recordManID]
			})
			
			if(leagueData.status == 'complete' || week > leagueData.settings.playoff_week_start - 1) {
				leastSeasonLongPoints.push({
					recordManID,
					fpts,
					fptspg,
					year,
					manager: originalManagers[recordManID]
				})
			}
		}
		
		if(!currentManagers) {
			currentManagers = originalManagers;
		}

		// loop through each week of the season
		const matchupsPromises = [];
		let startWeek = parseInt(week);
		while(week > 0) {
			matchupsPromises.push(fetch(`https://api.sleeper.app/v1/league/${curSeason}/matchups/${week}`, {compress: true}))
			week--;
		}
	
		const matchupsRes = await waitForAll(...matchupsPromises).catch((err) => { console.error(err); });

		// convert the json matchup responses
		const matchupsJsonPromises = [];
		for(const matchupRes of matchupsRes) {
			const data = matchupRes.json();
			matchupsJsonPromises.push(data)
			if (!matchupRes.ok) {
				throw new Error(data);
			}
		}
		const matchupsData = await waitForAll(...matchupsJsonPromises).catch((err) => { console.error(err); });

		// now that we've used the current season ID for everything we need, set it to the previous season
		curSeason = leagueData.previous_league_id;

		const seasonPointsRecord = [];
		const seasonPointsLow = [];
		let matchupDifferentials = [];
		let indivweeks = {};
		let fptsWeeks = {};
		
		// process all the matchups
		for(const matchupWeek of matchupsData) {
			let matchups = {};

			for(const matchup of matchupWeek) {

				let recordManager = leagueManagers[matchup.roster_id].filter(m => m.yearsactive.includes(year));
				let recordManID = recordManager[0].managerID;

				const entry = {
					manager: originalManagers[recordManID],
					fpts: matchup.points,
					week: startWeek,
					year,
					rosterID: matchup.roster_id,
					epeWins: 0,
					epeTies: 0,
					epeLosses: 0,
					weekWinner: new Boolean(false),
					weekLoser: new Boolean(false),
					recordManID,
				}
				seasonPointsRecord.push(entry);
				seasonPointsLow.push(entry);
				leagueWeekRecords.push(entry);
				leagueWeekLows.push(entry);
	
				// add each entry to the matchup object
				if(!matchups[matchup.matchup_id]) {
					matchups[matchup.matchup_id] = [];
				}
				matchups[matchup.matchup_id].push(entry);

				if(!indivweeks[recordManID]) {
					indivweeks[recordManID] = [];
				}		
				indivweeks[recordManID].push(entry);	

				if(!fptsWeeks[startWeek]) {
					fptsWeeks[startWeek] = [];
				}		
				fptsWeeks[startWeek].push(entry.fpts);

				const starters = matchup.starters;
				const startersPTS = matchup.starters_points.sort((a, b) => b - a);
				// startersPTS = startersPTS.sort((a, b) => b - a);

				const players = matchup.players;
				const playersPTS = matchup.players_points;
				
				for(let i = 0; i < players.length; i++) {

					const playerID = players[i];
					const playerPoints = playersPTS[playerID];
					const playerInfo = playersInfo[playerID];

					let benched = new Boolean (true);
					if(starters.includes(playerID)) {
						benched = false;
					}

					let topStarter = new Boolean (false);
					let starterRank;

					if(benched == false) {
						starterRank = startersPTS.indexOf(playerPoints) + 1;
						if(startersPTS[0] == playerPoints) {
							topStarter = true;
						}
					} else {
						starterRank = 0;
					}

					const playerEntry = {		
						recordManID,
						manager: originalManagers[recordManID],
						week: startWeek,
						year,
						rosterID: matchup.roster_id,
						playerID,
						playerPoints,
						howAcquired: [],
						benched,
						topStarter,
						starterRank,
						playerInfo,
						pos: playerInfo.pos,
					}
					
					// const season = parseInt(year);
					if(!playerRecords[playerID]) {
						playerRecords[playerID] = {};
					}
					if(!playerRecords[playerID][year]) {
						playerRecords[playerID][year] = {};
					}
					if(!playerRecords[playerID][year][recordManID]) {
						playerRecords[playerID][year][recordManID] = [];
					}
					playerRecords[playerID][year][recordManID].push(playerEntry);
				}
				
			}
			startWeek--;
			
					      
			// create matchup differentials from matchups obj
			for(const matchupKey in matchups) {
				const matchup = matchups[matchupKey];
				let home = matchup[0];
				let away = matchup[1];
				if(matchup[0].fpts < matchup[1].fpts) {
					home = matchup[1];
					away = matchup[0];
				}
				const matchupDifferential = {
					year: home.year,
					week: home.week,
					home: {
						manager: home.manager,
						fpts: home.fpts,
						recordManID: home.recordManID,
					},
					away: {
						manager: away.manager,
						fpts: away.fpts,
						recordManID: away.recordManID,
					},
					differential: home.fpts - away.fpts
				}
				allTimeMatchupDifferentials.push(matchupDifferential);
				matchupDifferentials.push(matchupDifferential);
			}
		}
		
		let weekBests = [];
		let weekWorsts = [];
		let seasonBests = [];
		let seasonWorsts = [];
		let seasonEPERecords = [];

		for(const recordManID in indivweeks) {
			const indivweek = indivweeks[recordManID];
			let bestweekfpts = 0;
			let worstweekfpts = 1000;

			let totalfpts = 0;
			let totalEPEWins = 0;
			let totalEPETies = 0;
			let totalEPELosses = 0;
			let totalWeekWinners = 0;
			let totalWeekLosers = 0;

			let bestWeek = {
				fpts: [],
				week: [],
				year: [],
				manager: [],
				recordManID: [],
			};
			let worstWeek = {
				fpts: [],
				week: [],
				year: [],
				manager: [],
				recordManID: [],
			};

			// going through every week for this roster
			for( let i = 0; i < indivweek.length; i++) {
				// check if this week's score is the best of roster's season; if so, set that as the new best score and grab the data from that week
				// need to add logic for (unlikely) scenario where you tie your own best/worst score
				if(indivweek[i].fpts > bestweekfpts) {
					bestweekfpts = indivweek[i].fpts;
					bestWeek = {
						fpts: indivweek[i].fpts,
						week: indivweek[i].week,
						year: indivweek[i].year,
						manager: indivweek[i].manager,
						recordManID: indivweek[i].recordManID,
					};
				}
				// check if this week's score is the worst of roster's season; if so, set and grab
				if(indivweek[i].fpts < worstweekfpts) {
					worstweekfpts = indivweek[i].fpts;
					worstWeek = {
						fpts: indivweek[i].fpts,
						week: indivweek[i].week,
						year: indivweek[i].year,
						manager: indivweek[i].manager,
						recordManID: indivweek[i].recordManID,
					};				
				}

				// compare roster's score to every score that week to determine whom they "beat", "tie", or "lose" to
				// note that fptsWeeks goes forward from week 1 while indivweek goes backward from the last played week 
				for( let x = 0; x < fptsWeeks[indivweek.length - i].length; x++) {
					if (indivweek[i].fpts > fptsWeeks[indivweek.length - i][x]) {
						indivweek[i].epeWins++;
					} else if (indivweek[i].fpts == fptsWeeks[indivweek.length - i][x]) {
						indivweek[i].epeTies++;
					} else {
						indivweek[i].epeLosses++;
					}
				}
				// reduce epeTies by one every week to account for the roster "tying" its own score
				indivweek[i].epeTies--;
				// determine if roster was the highest or lowest scorer that week
				// needs logic for (unlikely) scenario where you tie someone else for first/last place that week
				if (indivweek[i].epeWins == fptsWeeks[indivweek.length - i].length - 1) {
					indivweek[i].weekWinner = true;
					totalWeekWinners++;
				} else if (indivweek[i].epeWins == 0) {
					indivweek[i].weekLoser = true;
					totalWeekLosers++;
				}

				// add that week's fpts & EPE stats to the roster's running total for the season
				totalfpts += indivweek[i].fpts;
				totalEPEWins += indivweek[i].epeWins;
				totalEPETies += indivweek[i].epeTies;
				totalEPELosses += indivweek[i].epeLosses;
				
			}

			// calculate roster's season-long PPG & EPE Win %
			const totalfptspg = totalfpts / indivweek.length;
			const totalEPEWinPercentage = (totalEPEWins + totalEPETies / 2) / (totalEPEWins + totalEPETies + totalEPELosses) * 100;

			const weekEntry = {
				fptsBest: {bestWeek},
				fptsWorst: {worstWeek},
				totalfpts,
				totalfptspg,
				totalEPELosses,
				totalEPETies,
				totalEPEWins,
				totalEPEWinPercentage,
				totalWeekWinners,
				totalWeekLosers,
				recordManID,
				manager: originalManagers[recordManID],
				year,
			};

			const seasonEntry = {
				fpts: totalfpts,
				fptspg: totalfptspg,
				recordManID,
				manager: originalManagers[recordManID],
				year,
			};

			const seasonEPEEntry = {
				epeL: totalEPELosses,
				epeT: totalEPETies,
				epeW: totalEPEWins,
				epePerc: totalEPEWinPercentage,
				weekWin: totalWeekWinners,
				weekLoss: totalWeekLosers,
				recordManID,
				manager: originalManagers[recordManID],
				year,
			};

			if(!individualWeekRecords[recordManID]) {
				individualWeekRecords[recordManID] = [];
			}
			individualWeekRecords[recordManID].push(weekEntry);

			weekBests.push(bestWeek);
			weekWorsts.push(worstWeek);

			seasonBests.push(seasonEntry);
			seasonWorsts.push(seasonEntry);

			seasonEPERecords.push(seasonEPEEntry);
		}

		weekBests = weekBests.sort((a, b) => b.fpts - a.fpts);
		weekWorsts = weekWorsts.sort((a, b) => b.fpts - a.fpts);
		seasonBests = seasonBests.sort((a, b) => b.fpts - a.fpts);
		seasonWorsts = seasonWorsts.sort((a, b) => b.fpts - a.fpts);
		seasonEPERecords = seasonEPERecords.sort((a, b) => b.epePerc - a.epePerc);

		matchupDifferentials = matchupDifferentials.sort((a, b) => b.differential - a.differential);
		const biggestBlowouts = matchupDifferentials.slice(0, 10);

		const closestMatchups = [];
		for(let i = 0; i < 10; i++) {
			closestMatchups.push(matchupDifferentials.pop());
		}

		const interSeasonEntry = {
			year,
			biggestBlowouts,
			closestMatchups,
			weekBests,
			weekWorsts,
			seasonBests,
			seasonWorsts,
			seasonEPERecords,
			seasonPointsRecords: seasonPointsRecord.sort((a, b) => b.fpts - a.fpts).slice(0, 10),
			seasonPointsLows: seasonPointsLow.sort((a, b) => a.fpts - b.fpts).slice(0, 10)
		}

		if(interSeasonEntry.seasonPointsRecords.length > 0) {
			if(!currentYear) {
				currentYear = year;
			}
			seasonWeekRecords.push(interSeasonEntry);
		};
		
	}

	for(const recordManID in individualWeekRecords) {
		const individualWeekRecord = individualWeekRecords[recordManID];

		let allTimeBestWeekfpts = 0;
		let allTimeWorstWeekfpts = 1000;
		let allTimeBestSeasonfpts = 0;
		let allTimeWorstSeasonfpts = 5000;

		let allTimeEPEEntry = {
			epeL: 0,
			epeT: 0,
			epeW: 0,
			epePerc: 0,
			weekWin: 0,
			weekLoss: 0,
			recordManID: [],
			manager: [],
			year: [],
		};

		let allTimeBestWeek = {
			fpts: [],
			week: [],
			year: [],
			manager: [],
			recordManID: [],
		};
		let allTimeWorstWeek = {
			fpts: [],
			week: [],
			year: [],
			manager: [],
			recordManID: [],
		};

		let allTimeBestSeason = {
			fpts: [],
			fptspg: [],
			year: [],
			manager: [],
			recordManID: [],
		};

		let allTimeWorstSeason = {
			fpts: [],
			fptspg: [],
			year: [],
			manager: [],
			recordManID: [],
		};

		// going through every season for this roster
		for(let i = 0; i < individualWeekRecord.length; i++) {

			if(individualWeekRecord[i].fptsBest.bestWeek.fpts > allTimeBestWeekfpts) {
				allTimeBestWeekfpts = individualWeekRecord[i].fptsBest.bestWeek.fpts;
				allTimeBestWeek = {
					fpts: individualWeekRecord[i].fptsBest.bestWeek.fpts,
					week: individualWeekRecord[i].fptsBest.bestWeek.week,
					year: individualWeekRecord[i].fptsBest.bestWeek.year,
					manager: individualWeekRecord[i].fptsBest.bestWeek.manager,
					recordManID: individualWeekRecord[i].fptsBest.bestWeek.recordManID,
				}
			}

			if(individualWeekRecord[i].fptsWorst.worstWeek.fpts < allTimeWorstWeekfpts) {
				allTimeWorstWeekfpts = individualWeekRecord[i].fptsWorst.worstWeek.fpts;
				allTimeWorstWeek = {
					fpts: individualWeekRecord[i].fptsWorst.worstWeek.fpts,
					week: individualWeekRecord[i].fptsWorst.worstWeek.week,
					year: individualWeekRecord[i].fptsWorst.worstWeek.year,
					manager: individualWeekRecord[i].fptsWorst.worstWeek.manager,
					recordManID: individualWeekRecord[i].fptsWorst.worstWeek.recordManID,
				}
			}

			if(individualWeekRecord[i].totalfpts > allTimeBestSeasonfpts) {
				allTimeBestSeasonfpts = individualWeekRecord[i].totalfpts;
				allTimeBestSeason = {
					fpts: individualWeekRecord[i].totalfpts,
					fptspg: individualWeekRecord[i].totalfptspg,
					year: individualWeekRecord[i].year,
					manager: individualWeekRecord[i].manager,
					recordManID: individualWeekRecord[i].recordManID,
				}
			}
				// needs (actual) logic to exclude current season
			if(individualWeekRecord[i].totalfpts < allTimeWorstSeasonfpts && individualWeekRecord[i].year != 2021) {
				allTimeWorstSeasonfpts = individualWeekRecord[i].totalfpts;
				allTimeWorstSeason = {
					fpts: individualWeekRecord[i].totalfpts,
					fptspg: individualWeekRecord[i].totalfptspg,
					year: individualWeekRecord[i].year,
					manager: individualWeekRecord[i].manager,
					recordManID: individualWeekRecord[i].recordManID,
				}
			}

			allTimeEPEEntry.epeL += individualWeekRecord[i].totalEPELosses;
			allTimeEPEEntry.epeT += individualWeekRecord[i].totalEPETies;
			allTimeEPEEntry.epeW += individualWeekRecord[i].totalEPEWins;
			allTimeEPEEntry.weekWin += individualWeekRecord[i].totalWeekWinners;
			allTimeEPEEntry.weekLoss += individualWeekRecord[i].totalWeekLosers;
			allTimeEPEEntry.recordManID = individualWeekRecord[i].recordManID;
			allTimeEPEEntry.manager = individualWeekRecord[i].manager;
			allTimeEPEEntry.year = individualWeekRecord[i].year;

		}

		allTimeEPEEntry.epePerc = ((allTimeEPEEntry.epeW + allTimeEPEEntry.epeT / 2) / (allTimeEPEEntry.epeW + allTimeEPEEntry.epeT + allTimeEPEEntry.epeL) * 100);

		allTimeWeekBests.push(allTimeBestWeek);
		allTimeWeekWorsts.push(allTimeWorstWeek);
		allTimeSeasonBests.push(allTimeBestSeason);
		allTimeSeasonWorsts.push(allTimeWorstSeason);

		allTimeEPERecords.push(allTimeEPEEntry);

	}

	allTimeWeekBests = allTimeWeekBests.sort((a, b) => b.fpts - a.fpts);
	allTimeWeekWorsts = allTimeWeekWorsts.sort((a, b) => b.fpts - a.fpts);
	allTimeSeasonBests = allTimeSeasonBests.sort((a, b) => b.fpts - a.fpts);
	allTimeSeasonWorsts = allTimeSeasonWorsts.sort((a, b) => b.fpts - a.fpts);

	allTimeEPERecords = allTimeEPERecords.sort((a, b) => b.epePerc - a.epePerc);


	allTimeMatchupDifferentials = allTimeMatchupDifferentials.sort((a, b) => b.differential - a.differential);
	allTimeBiggestBlowouts = allTimeMatchupDifferentials.slice(0, 10);

	for(let i = 0; i < 10; i++) {
		allTimeClosestMatchups.push(allTimeMatchupDifferentials.pop());
	}
	
	leagueWeekRecords = leagueWeekRecords.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
	leagueWeekLows = leagueWeekLows.sort((a, b) => a.fpts - b.fpts).slice(0, 10);
	mostSeasonLongPoints = mostSeasonLongPoints.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
	leastSeasonLongPoints = leastSeasonLongPoints.sort((a, b) => a.fpts - b.fpts).slice(0, 10);


	const recordsData = {
		allTimeBiggestBlowouts,
		allTimeClosestMatchups,
		allTimeWeekBests,
		allTimeWeekWorsts,
		allTimeSeasonBests,
		allTimeSeasonWorsts,
		allTimeEPERecords,
		mostSeasonLongPoints,
		leastSeasonLongPoints,
		leagueWeekLows,
		individualWeekRecords,
		leagueWeekRecords,
		seasonWeekRecords,
		leagueRosterRecords,
		currentManagers,
		currentYear,
		lastYear
	};

	// update localStorage
	localStorage.setItem("records", JSON.stringify(recordsData));

	records.update(() => recordsData);

	return recordsData;
}