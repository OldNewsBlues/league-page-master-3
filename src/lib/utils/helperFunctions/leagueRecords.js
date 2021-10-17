import { getLeagueData } from './leagueData';
import { leagueID, managers } from '$lib/utils/leagueInfo';
import { getNflState } from './nflState';
import { getLeagueRosters } from "./leagueRosters"
import { getLeagueUsers } from "./leagueUsers"
import { waitForAll } from './multiPromise';
import { get } from 'svelte/store';
import {records} from '$lib/stores';
import { loadPlayers, getPreviousDrafts } from '$lib/utils/helper';

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

	const playersData = await loadPlayers().catch((err) => { console.error(err); });
	const playersInfo = playersData.players;

	const previousDraftsData = await getPreviousDrafts().catch((err) => { console.error(err); });
	let draftInfo = {};

	for(const key in previousDraftsData) {
		const prevDraft = previousDraftsData[key];
		
		if(!draftInfo[prevDraft.year]) {
			draftInfo[prevDraft.year] = prevDraft;
		}
	}

	const nflState = await getNflState().catch((err) => { console.error(err); });
	let week = 0;
	let POrecordsWeek = 0;
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
	let allTimePOMatchupDifferentials = [];

	let leagueRosterRecords = {}; 				// every full season stat point (for each year and all years combined)
	let playoffRosterRecords = {}; 
	let seasonWeekRecords = []; 				// highest weekly points within a single season
	let playoffWeekRecords = [];
	let leagueWeekRecords = [];					// highest weekly points within a single season
	let leaguePOWeekRecords = [];
	let leagueWeekLows = []; 					// lowest weekly points within a single season
	let leaguePOWeekLows = [];

	let mostSeasonLongPoints = []; 				// 10 highest full season points
	let mostPlayoffLongPoints = [];
	let leastPlayoffLongPoints = [];
	let leastSeasonLongPoints = []; 			// 10 lowest full season points

	let allTimeBiggestBlowouts = []; 			// 10 biggest blowouts
	let allTimeBiggestPOBlowouts = [];
	let allTimeClosestMatchups = []; 			// 10 closest matchups
	let allTimeClosestPOMatchups = [];

	let individualWeekRecords = {}; 			// weekly scores/matchup data indexed by managerID
	let individualPOWeekRecords = {};

	let allTimeWeekBests = []; 					// each manager's highest scoring week
	let allTimeWeekWorsts = []; 				// each manager's lowest scoring week
	let allTimeSeasonBests = []; 				// each manager's highest scoring season
	let allTimeSeasonWorsts = []; 				// each manager's lowest scoring season
	let allTimeEPERecords = [];					// each manager's all-time EPE stats

	let allTimePOWeekBests = []; 					// each manager's highest scoring week
	let allTimePOWeekWorsts = []; 				// each manager's lowest scoring week
	let allTimePlayoffBests = []; 				// each manager's highest scoring season
	let allTimePlayoffWorsts = []; 				// each manager's lowest scoring season
	let allTimePOEPERecords = [];					// each manager's all-time EPE stats

	let playerATSeasonBests = []; 				// each manager's all-time leading individual starter (season)
	let	playerATSeasonRecords = [];				// ranking all manager's all-time highest-scoring player (season), indexed by manager and season
	let playerATWeekBests = [];					// each manager's all-time best scoring week by individual starters
	let playerATWeekMissedBests = [];
	let playerATWeekRecords = [];				// each manager's all-time best scoring week by individual starters, indexed by manager and season
	let playerATWeekMissedRecords = [];				// each manager's all-time best scoring week by individual starters, indexed by manager and season
	let playerATWeekTOPS = [];					// 10 all-time best scoring weeks by individual starters
	let playerATSeasonTOPS = [];				// 10 all-time best scoring seasons by individual starters

	let playerATPlayoffBests = []; 				// each manager's all-time leading individual starter (season)
	let	playerATPlayoffRecords = [];				// ranking all manager's all-time highest-scoring player (season), indexed by manager and season
	let playerATPOWeekBests = [];					// each manager's all-time best scoring week by individual starters
	let playerATPOWeekMissedBests = [];
	let playerATPOWeekRecords = [];				// each manager's all-time best scoring week by individual starters, indexed by manager and season
	let playerATPOWeekMissedRecords = [];				// each manager's all-time best scoring week by individual starters, indexed by manager and season
	let playerATPOWeekTOPS = [];					// 10 all-time best scoring weeks by individual starters
	let playerATPlayoffTOPS = [];				// 10 all-time best scoring seasons by individual starters

	let leagueManagers = {};
	let activeManagers = [];

	let playerRecords = {};
	let seasonPlayerRecords = {};
	let seasonTeamPOSRecords = {};

	let POplayerRecords = {};
	let playoffPlayerRecords = {};
	let playoffTeamPOSRecords = {};

	let acquisitionRecords = {};

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

		// variables for playoff records
		let numPOTeams = parseInt(leagueData.settings.playoff_teams);
		let playoffStart = parseInt(leagueData.settings.playoff_week_start);
		let playoffLength;
		let playoffType;
		let playoffCase;							// for later determining which playoff matchups we want to count (vs. discard)

		// before 2020, 1 week per PO round was only option
		if(year > 2019) {
			playoffType = parseInt(leagueData.settings.playoff_round_type);
		} else {
			playoffType = 0;
		}

		// calculate length of playoffs										"Relevant" Match IDs
		if(playoffType == 0) {							// 1W/r		4-team		6-team		8-team
			if(numPOTeams == 6) {						// last:	1, 2		1, 2		1, 2, 3, 4 						
				playoffLength = 3;						// 2-last:	1, 2		1, 2, 3		1, 2, 3, 4
				playoffCase = 1;						// 3-last:				1, 2		1, 2, 3, 4
			} else if(numPOTeams == 8) {
				playoffLength = 3;
				playoffCase = 2;
			} else if(numPOTeams == 4) {			
				playoffLength = 2;						
				playoffCase = 3;					
			}
		} else if(playoffType == 1 && year > 2020) {	// 1W/r+2c  4-team		6-team		8-team
			if(numPOTeams == 6) {						// last:	1			1			1
				playoffLength = 4;						// 2-last:	1, 2		1, 2		1, 2, 3, 4
				playoffCase = 4;						// 3-last:	1, 2		1, 2, 3		1, 2, 3, 4
			} else if(numPOTeams == 8) {				// 4-last:				1, 2		1, 2, 3, 4
				playoffLength = 4;
				playoffCase = 5
			} else if(numPOTeams == 4) {
				playoffLength = 3;
				playoffCase = 6;
			}
		} else if(playoffType == 2 ||
				  playoffType == 1 && year == 2020) {	// 2W/r  	4-team		6-team		8-team
			if(numPOTeams == 6) {						// last:	1, 2		1, 2		1, 2, 3, 4	
				playoffLength = 6;						// 2-last:	1, 2		1, 2		1, 2, 3, 4	
				playoffCase = 7;						// 3-last:	1, 2		1, 2, 3 	1, 2, 3, 4
			} else if (numPOTeams == 8) {				// 4-last: 	1, 2		1, 2, 3		1, 2, 3, 4
				playoffLength = 6;						// 5-last:				1, 2		1, 2, 3, 4
				playoffCase = 8;						// 6-last:				1, 2		1, 2, 3, 4
			} else if (numPOTeams == 4) {
				playoffLength = 4;
				playoffCase = 9;
			}
		}

		POrecordsWeek = playoffStart + playoffLength - 1;

		// on first run, week is provided above from nflState,
		// after that get the final week of regular season from leagueData
		if(leagueData.status == 'complete' || week > playoffStart - 1) {
			week = playoffStart - 1;
		}

		lastYear = year;
	
		const rosters = rosterRes.rosters;
		
		for(const roster of rosters) {
			const rosterID = roster.roster_id;		

			let recordManager = leagueManagers[rosterID].filter(m => m.yearsactive.includes(year));
			let recordManrosterID = recordManager[0].rosterID;
			let recordManID = recordManager[0].managerID;
			
			const draftResults = draftInfo[year].draft;
			for(const round in draftResults) {
				const draftPicks = draftResults[round];

				for(const pick in draftPicks) {
					const draftPick = draftPicks[pick].player;

					if(!acquisitionRecords[year]) {
						acquisitionRecords[year] = {};
					}

					if(draftPick.rosterID == recordManrosterID) {

						if(!acquisitionRecords[year][recordManID]) {
							acquisitionRecords[year][recordManID] = [];
						}
						acquisitionRecords[year][recordManID].push(draftPick);
					}
				}
			}
		}

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

			if(!playoffRosterRecords[recordManID]) {
				playoffRosterRecords[recordManID] = {
					wins: 0,
					losses: 0,
					ties: 0,
					fptsFor: 0,
					fptsAgainst: 0,
					potentialPoints: 0,
					fptspg: 0,
					POgames: 0,
					manager: originalManagers[recordManID],
					years: {},
					recordManID,
				}
			}

			playoffRosterRecords[recordManID].years[year] = {
				wins: 0,
				losses: 0,
				ties: 0,
				fpts: 0,
				fptsAgainst: 0,
				potentialPoints: 0,
				fptspg: 0,
				POgames: 0,
				manager: originalManagers[recordManID],
				year,
				recordManID,
			}
				
		}
		
		if(!currentManagers) {
			currentManagers = originalManagers;
		}

		// loop through each week of the season
		const matchupsPromises = [];
		let startWeek = parseInt(week);

		const POmatchupsPromises = [];
		let POstartWeek = parseInt(POrecordsWeek);

		while(week > 0) {
			matchupsPromises.push(fetch(`https://api.sleeper.app/v1/league/${curSeason}/matchups/${week}`, {compress: true}))
			week--;
		}
		while(POrecordsWeek > playoffStart - 1) {
			POmatchupsPromises.push(fetch(`https://api.sleeper.app/v1/league/${curSeason}/matchups/${POrecordsWeek}`, {compress: true}))
			POrecordsWeek--;
		}
	
		const matchupsRes = await waitForAll(...matchupsPromises).catch((err) => { console.error(err); });
		const POmatchupsRes = await waitForAll(...POmatchupsPromises).catch((err) => { console.error(err); });

		// convert the json matchup responses
			//regular season
		const matchupsJsonPromises = [];
		for(const matchupRes of matchupsRes) {
			const data = matchupRes.json();
			matchupsJsonPromises.push(data)
			if (!matchupRes.ok) {
				throw new Error(data);
			}
		}
		const matchupsData = await waitForAll(...matchupsJsonPromises).catch((err) => { console.error(err); });
			// playoffs
		const POmatchupsJsonPromises = [];
		for(const POmatchupRes of POmatchupsRes) {
			const POdata = POmatchupRes.json();
			POmatchupsJsonPromises.push(POdata)
			if (!POmatchupRes.ok) {
				throw new Error(POdata);
			}
		}
		const POmatchupsData = await waitForAll(...POmatchupsJsonPromises).catch((err) => { console.error(err); });

		// now that we've used the current season ID for everything we need, set it to the previous season
		curSeason = leagueData.previous_league_id;

		const seasonPointsRecord = [];
		const seasonPointsLow = [];
		let matchupDifferentials = [];
		let indivweeks = {};
		let fptsWeeks = {};
		
		let duplicateKeyArr = [];

		let playerWeekTOPS = [];				// top 10 player single-week scores
		let	playerWeekBests = [];				// ranking all manager's highest-scoring player (week)
		let playerWeekEfforts = [];
		let playerWeekMissedBests = [];
		let playerWeekMissedEfforts = [];

		let playerPOWeekTOPS = [];				// top 10 player single-week scores
		let	playerPOWeekBests = [];				// ranking all manager's highest-scoring player (week)
		let playerPOWeekEfforts = [];
		let playerPOWeekMissedBests = [];
		let playerPOWeekMissedEfforts = [];

		const playoffPointsRecord = [];
		const playoffPointsLow = [];
		let POmatchupDifferentials = [];
		let indivPOweeks = {};
		let POfptsWeeks = {};
	
		if(startWeek > playoffStart - 1 || leagueData.status == 'complete') {
			// process all the PLAYOFFS matchups

			for(const POmatchupWeek of POmatchupsData) {
				let POmatchups = {};
				let POround = POstartWeek - POrecordsWeek;

				for(const POmatchup of POmatchupWeek) {
					let recordManager = leagueManagers[POmatchup.roster_id].filter(m => m.yearsactive.includes(year));
					let recordManID = recordManager[0].managerID;

					const POentry = {
						manager: originalManagers[recordManID],
						fpts: POmatchup.points,
						starters_points: POmatchup.starters_points,
						players_points: POmatchup.players_points,
						starters: POmatchup.starters,
						players: POmatchup.players,
						week: POstartWeek,
						year,
						rosterID: POmatchup.roster_id,
						recordManID,
					}

					// add each entry to the POmatchup object
					if(!POmatchups[POmatchup.matchup_id]) {
						POmatchups[POmatchup.matchup_id] = [];
					}
					POmatchups[POmatchup.matchup_id].push(POentry);
				}

				if(playoffCase == 4 && POstartWeek == POrecordsWeek + playoffLength ||     // Relevant Match IDs: 1
				   playoffCase == 5 && POstartWeek == POrecordsWeek + playoffLength ||
				   playoffCase == 6 && POstartWeek == POrecordsWeek + playoffLength) {

					const champMatch = POmatchups[1];

					let home = champMatch[0];
					let away = champMatch[1];
					if(champMatch[0].fpts < champMatch[1].fpts) {
						home = champMatch[1];
						away = champMatch[0];
					}

					const POmatchupDifferential = {
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
					allTimePOMatchupDifferentials.push(POmatchupDifferential);
					POmatchupDifferentials.push(POmatchupDifferential);

					for(const key in champMatch) {
						const opponent = champMatch[key];

						playoffRosterRecords[opponent.recordManID].years[year].fpts += opponent.fpts;
						playoffRosterRecords[opponent.recordManID].years[year].POgames++;

						const POweekEntry = {
							manager: opponent.manager,
							recordManID: opponent.recordManID,
							rosterID: opponent.rosterID,
							fpts: opponent.fpts,
							epePOWins: 0,
							epePOTies: 0,
							epePOLosses: 0,
							POweekWinner: new Boolean(false),
							POweekLoser: new Boolean(false),
							week: opponent.week,
							year,
						}

						if(!indivPOweeks[opponent.recordManID]) {
							indivPOweeks[opponent.recordManID] = [];
						}		
						indivPOweeks[opponent.recordManID].push(POweekEntry);
	
						if(!POfptsWeeks[POstartWeek]) {
							POfptsWeeks[POstartWeek] = [];
						}	
						POfptsWeeks[POstartWeek].push(POweekEntry.fpts);

						playoffPointsRecord.push(POweekEntry);
						playoffPointsLow.push(POweekEntry);
						leaguePOWeekRecords.push(POweekEntry);
						leaguePOWeekLows.push(POweekEntry);

						const starters = opponent.starters;
						const startersPTS = opponent.starters_points.sort((a, b) => b - a);
		
						const players = opponent.players;
						const playersPTS = opponent.players_points;
						
						for(let i = 0; i < players.length; i++) {
		
							const playerID = players[i];
		
							if(!POplayerRecords[year]) {
								POplayerRecords[year] = {};
							}
							if(!POplayerRecords[year][opponent.recordManID]) {
								POplayerRecords[year][opponent.recordManID] = {};
							}
		
							const playerPoints = playersPTS[playerID];
		
							let topStarter = new Boolean (false);
							let starterRank;
							let benched = new Boolean (true);
		
							if(starters.includes(playerID)) {
								benched = false;
								starterRank = startersPTS.indexOf(playerPoints) + 1;
								if(startersPTS[0] == playerPoints) {
									topStarter = true;
								}
							} else {
								benched = true;
								topStarter = false;
								starterRank = 0;
							}
							
							// idea for dupe check is to push unique info into array the first time the playerID is seen (so you can later check array for dupes)
							let isDuplicate = new Boolean (false);
							let playerInfo = playersInfo[playerID];
							let duplicateCheck = {
								fn: playerInfo.fn,
								ln: playerInfo.ln,
								pos: playerInfo.pos,
								t: playerInfo.t,
							}
							if(!duplicateKeyArr[opponent.recordManID]) {
								duplicateKeyArr[opponent.recordManID] = [];
							}
							if(!POplayerRecords[year][opponent.recordManID][playerID]) {
								POplayerRecords[year][opponent.recordManID][playerID] = [];
								duplicateKeyArr[opponent.recordManID].push(duplicateCheck);
							}
							// duplicateKeyArr[recordManID].forEach(str => isDuplicate[str] ? alert(str) : isDuplicate[str] = true);
							// DUPE CHECK NOT COMPLETE/WORKING (& not entirely sure if necessary)
		
							const playerEntry = {		
								recordManID: opponent.recordManID,
								manager: originalManagers[opponent.recordManID],
								week: POstartWeek,
								year,
								rosterID: opponent.rosterID,
								playerID,
								playerPoints,
								benched,
								howAcquired: null,
								weekAcquired: null,
								topStarter,
								starterRank,
								playerInfo,
								isDuplicate,
							}
		
							// right now, acquisitions is just a list of the manager's draft picks
							let acquisitions = acquisitionRecords[year][opponent.recordManID];
							for(let i = 0; i < acquisitions.length; i++) {
								if(acquisitions[i].playerID == playerID) {
									playerEntry.howAcquired = 'draft';
									playerEntry.weekAcquired = 0;
								} 
							}
							
							POplayerRecords[year][opponent.recordManID][playerID].push(playerEntry);
						}
					}

					playoffRosterRecords[home.recordManID].years[year].fptsAgainst += away.fpts;
					playoffRosterRecords[away.recordManID].years[year].fptsAgainst += home.fpts;

					if(POmatchupDifferential.differential == 0) {
						playoffRosterRecords[home.recordManID].years[year].ties++;
						playoffRosterRecords[away.recordManID].years[year].ties++;
					} else {
						playoffRosterRecords[home.recordManID].years[year].wins++;
						playoffRosterRecords[away.recordManID].years[year].losses++;
					}
				} else if(playoffCase == 3 ||														// Relevant Match IDs: 1, 2
				   		  playoffCase == 9 ||
				   		  playoffCase == 6 && POstartWeek < POrecordsWeek + playoffLength ||
				 		  playoffCase == 1 && POround != 2 ||
				 		  playoffCase == 4 && POround == 1 ||
				  		  playoffCase == 4 && POround == 3 ||
					      playoffCase == 7 && POround < 3 ||
				  		  playoffCase == 7 && POround > 4) {
					
					for(let i = 1; i < 3; i++) {

						let home = POmatchups[i][0];
						let away = POmatchups[i][1];
						if(POmatchups[i][0].fpts < POmatchups[i][1].fpts) {
							home = POmatchups[i][1];
							away = POmatchups[i][0];
						}
	
						const POmatchupDifferential = {
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
						allTimePOMatchupDifferentials.push(POmatchupDifferential);
						POmatchupDifferentials.push(POmatchupDifferential);

						for(const key in POmatchups[i]) {
							const opponent = POmatchups[i][key];

							playoffRosterRecords[opponent.recordManID].years[year].fpts += opponent.fpts;
							playoffRosterRecords[opponent.recordManID].years[year].POgames++;
	
							const POweekEntry = {
								manager: opponent.manager,
								recordManID: opponent.recordManID,
								rosterID: opponent.rosterID,
								fpts: opponent.fpts,
								epePOWins: 0,
								epePOTies: 0,
								epePOLosses: 0,
								POweekWinner: new Boolean(false),
								POweekLoser: new Boolean(false),
								week: opponent.week,
								year,
							}

							if(!indivPOweeks[opponent.recordManID]) {
								indivPOweeks[opponent.recordManID] = [];
							}		
							indivPOweeks[opponent.recordManID].push(POweekEntry);
		
							if(!POfptsWeeks[POstartWeek]) {
								POfptsWeeks[POstartWeek] = [];
							}	
							POfptsWeeks[POstartWeek].push(POweekEntry.fpts);
							
							playoffPointsRecord.push(POweekEntry);
							playoffPointsLow.push(POweekEntry);
							leaguePOWeekRecords.push(POweekEntry);
							leaguePOWeekLows.push(POweekEntry);

							const starters = opponent.starters;
							const startersPTS = opponent.starters_points.sort((a, b) => b - a);
			
							const players = opponent.players;
							const playersPTS = opponent.players_points;
							
							for(let i = 0; i < players.length; i++) {
			
								const playerID = players[i];
			
								if(!POplayerRecords[year]) {
									POplayerRecords[year] = {};
								}
								if(!POplayerRecords[year][opponent.recordManID]) {
									POplayerRecords[year][opponent.recordManID] = {};
								}
			
								const playerPoints = playersPTS[playerID];
			
								let topStarter = new Boolean (false);
								let starterRank;
								let benched = new Boolean (true);
			
								if(starters.includes(playerID)) {
									benched = false;
									starterRank = startersPTS.indexOf(playerPoints) + 1;
									if(startersPTS[0] == playerPoints) {
										topStarter = true;
									}
								} else {
									benched = true;
									topStarter = false;
									starterRank = 0;
								}
								
								// idea for dupe check is to push unique info into array the first time the playerID is seen (so you can later check array for dupes)
								let isDuplicate = new Boolean (false);
								let playerInfo = playersInfo[playerID];
								let duplicateCheck = {
									fn: playerInfo.fn,
									ln: playerInfo.ln,
									pos: playerInfo.pos,
									t: playerInfo.t,
								}
								if(!duplicateKeyArr[opponent.recordManID]) {
									duplicateKeyArr[opponent.recordManID] = [];
								}
								if(!POplayerRecords[year][opponent.recordManID][playerID]) {
									POplayerRecords[year][opponent.recordManID][playerID] = [];
									duplicateKeyArr[opponent.recordManID].push(duplicateCheck);
								}
								// duplicateKeyArr[recordManID].forEach(str => isDuplicate[str] ? alert(str) : isDuplicate[str] = true);
								// DUPE CHECK NOT COMPLETE/WORKING (& not entirely sure if necessary)
			
								const playerEntry = {		
									recordManID: opponent.recordManID,
									manager: originalManagers[opponent.recordManID],
									week: POstartWeek,
									year,
									rosterID: opponent.rosterID,
									playerID,
									playerPoints,
									benched,
									howAcquired: null,
									weekAcquired: null,
									topStarter,
									starterRank,
									playerInfo,
									isDuplicate,
								}
			
								// right now, acquisitions is just a list of the manager's draft picks
								let acquisitions = acquisitionRecords[year][opponent.recordManID];
								for(let i = 0; i < acquisitions.length; i++) {
									if(acquisitions[i].playerID == playerID) {
										playerEntry.howAcquired = 'draft';
										playerEntry.weekAcquired = 0;
									} 
								}
								
								POplayerRecords[year][opponent.recordManID][playerID].push(playerEntry);
							}
						}
	
						playoffRosterRecords[home.recordManID].years[year].fptsAgainst += away.fpts;
						playoffRosterRecords[away.recordManID].years[year].fptsAgainst += home.fpts;
	
						if(POmatchupDifferential.differential == 0) {
							playoffRosterRecords[home.recordManID].years[year].ties++;
							playoffRosterRecords[away.recordManID].years[year].ties++;
						} else {
							playoffRosterRecords[home.recordManID].years[year].wins++;
							playoffRosterRecords[away.recordManID].years[year].losses++;
						}
					}
				} else if(playoffCase == 7 && 2 < POround < 5 ||									// Relevant Match IDs: 1, 2, 3
				   		  playoffCase == 4 && POround == 2 ||
				   		  playoffCase == 1 && POround == 2) {

					for(let i = 1; i < 4; i++) {
						
						let home = POmatchups[i][0];
						let away = POmatchups[i][1];
						if(POmatchups[i][0].fpts < POmatchups[i][1].fpts) {
							home = POmatchups[i][1];
							away = POmatchups[i][0];
						}
	
						const POmatchupDifferential = {
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
						allTimePOMatchupDifferentials.push(POmatchupDifferential);
						POmatchupDifferentials.push(POmatchupDifferential);
	
						for(const key in POmatchups[i]) {
							const opponent = POmatchups[i][key];

							playoffRosterRecords[opponent.recordManID].years[year].fpts += opponent.fpts;
							playoffRosterRecords[opponent.recordManID].years[year].POgames++;
	
							const POweekEntry = {
								manager: opponent.manager,
								recordManID: opponent.recordManID,
								rosterID: opponent.rosterID,
								fpts: opponent.fpts,
								epePOWins: 0,
								epePOTies: 0,
								epePOLosses: 0,
								POweekWinner: new Boolean(false),
								POweekLoser: new Boolean(false),
								week: opponent.week,
								year,
							}

							if(!indivPOweeks[opponent.recordManID]) {
								indivPOweeks[opponent.recordManID] = [];
							}		
							indivPOweeks[opponent.recordManID].push(POweekEntry);
		
							if(!POfptsWeeks[POstartWeek]) {
								POfptsWeeks[POstartWeek] = [];
							}	
							POfptsWeeks[POstartWeek].push(POweekEntry.fpts);
	
							playoffPointsRecord.push(POweekEntry);
							playoffPointsLow.push(POweekEntry);
							leaguePOWeekRecords.push(POweekEntry);
							leaguePOWeekLows.push(POweekEntry);

							const starters = opponent.starters;
							const startersPTS = opponent.starters_points.sort((a, b) => b - a);
			
							const players = opponent.players;
							const playersPTS = opponent.players_points;
							
							for(let i = 0; i < players.length; i++) {
			
								const playerID = players[i];
			
								if(!POplayerRecords[year]) {
									POplayerRecords[year] = {};
								}
								if(!POplayerRecords[year][opponent.recordManID]) {
									POplayerRecords[year][opponent.recordManID] = {};
								}
			
								const playerPoints = playersPTS[playerID];
			
								let topStarter = new Boolean (false);
								let starterRank;
								let benched = new Boolean (true);
			
								if(starters.includes(playerID)) {
									benched = false;
									starterRank = startersPTS.indexOf(playerPoints) + 1;
									if(startersPTS[0] == playerPoints) {
										topStarter = true;
									}
								} else {
									benched = true;
									topStarter = false;
									starterRank = 0;
								}
								
								// idea for dupe check is to push unique info into array the first time the playerID is seen (so you can later check array for dupes)
								let isDuplicate = new Boolean (false);
								let playerInfo = playersInfo[playerID];
								let duplicateCheck = {
									fn: playerInfo.fn,
									ln: playerInfo.ln,
									pos: playerInfo.pos,
									t: playerInfo.t,
								}
								if(!duplicateKeyArr[opponent.recordManID]) {
									duplicateKeyArr[opponent.recordManID] = [];
								}
								if(!POplayerRecords[year][opponent.recordManID][playerID]) {
									POplayerRecords[year][opponent.recordManID][playerID] = [];
									duplicateKeyArr[opponent.recordManID].push(duplicateCheck);
								}
								// duplicateKeyArr[recordManID].forEach(str => isDuplicate[str] ? alert(str) : isDuplicate[str] = true);
								// DUPE CHECK NOT COMPLETE/WORKING (& not entirely sure if necessary)
			
								const playerEntry = {		
									recordManID: opponent.recordManID,
									manager: originalManagers[opponent.recordManID],
									week: POstartWeek,
									year,
									rosterID: opponent.rosterID,
									playerID,
									playerPoints,
									benched,
									howAcquired: null,
									weekAcquired: null,
									topStarter,
									starterRank,
									playerInfo,
									isDuplicate,
								}
			
								// right now, acquisitions is just a list of the manager's draft picks
								let acquisitions = acquisitionRecords[year][opponent.recordManID];
								for(let i = 0; i < acquisitions.length; i++) {
									if(acquisitions[i].playerID == playerID) {
										playerEntry.howAcquired = 'draft';
										playerEntry.weekAcquired = 0;
									} 
								}
								
								POplayerRecords[year][opponent.recordManID][playerID].push(playerEntry);
							}
						}
	
						playoffRosterRecords[home.recordManID].years[year].fptsAgainst += away.fpts;
						playoffRosterRecords[away.recordManID].years[year].fptsAgainst += home.fpts;
	
						if(POmatchupDifferential.differential == 0) {
							playoffRosterRecords[home.recordManID].years[year].ties++;
							playoffRosterRecords[away.recordManID].years[year].ties++;
						} else {
							playoffRosterRecords[home.recordManID].years[year].wins++;
							playoffRosterRecords[away.recordManID].years[year].losses++;
						}
					}
				} else if(playoffCase == 8 ||														// Relevant Match IDs: 1, 2, 3, 4
				   		  playoffCase == 2 ||
				   		  playoffCase == 5 && POstartWeek < POrecordsWeek + playoffLength) {

					for(let i = 1; i < 5; i++) {
						
						let home = POmatchups[i][0];
						let away = POmatchups[i][1];
						if(POmatchups[i][0].fpts < POmatchups[i][1].fpts) {
							home = POmatchups[i][1];
							away = POmatchups[i][0];
						}
	
						const POmatchupDifferential = {
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
						allTimePOMatchupDifferentials.push(POmatchupDifferential);
						POmatchupDifferentials.push(POmatchupDifferential);
	
						for(const key in POmatchups[i]) {
							const opponent = POmatchups[i][key];

							playoffRosterRecords[opponent.recordManID].years[year].fpts += opponent.fpts;
							playoffRosterRecords[opponent.recordManID].years[year].POgames++;
	
							const POweekEntry = {
								manager: opponent.manager,
								recordManID: opponent.recordManID,
								rosterID: opponent.rosterID,
								fpts: opponent.fpts,
								epePOWins: 0,
								epePOTies: 0,
								epePOLosses: 0,
								POweekWinner: new Boolean(false),
								POweekLoser: new Boolean(false),
								week: opponent.week,
								year,
							}

							if(!indivPOweeks[opponent.recordManID]) {
								indivPOweeks[opponent.recordManID] = [];
							}		
							indivPOweeks[opponent.recordManID].push(POweekEntry);
		
							if(!POfptsWeeks[POstartWeek]) {
								POfptsWeeks[POstartWeek] = [];
							}	
							POfptsWeeks[POstartWeek].push(POweekEntry.fpts);
	
							playoffPointsRecord.push(POweekEntry);
							playoffPointsLow.push(POweekEntry);
							leaguePOWeekRecords.push(POweekEntry);
							leaguePOWeekLows.push(POweekEntry);

							const starters = opponent.starters;
							const startersPTS = opponent.starters_points.sort((a, b) => b - a);
			
							const players = opponent.players;
							const playersPTS = opponent.players_points;
							
							for(let i = 0; i < players.length; i++) {
			
								const playerID = players[i];
			
								if(!POplayerRecords[year]) {
									POplayerRecords[year] = {};
								}
								if(!POplayerRecords[year][opponent.recordManID]) {
									POplayerRecords[year][opponent.recordManID] = {};
								}
			
								const playerPoints = playersPTS[playerID];
			
								let topStarter = new Boolean (false);
								let starterRank;
								let benched = new Boolean (true);
			
								if(starters.includes(playerID)) {
									benched = false;
									starterRank = startersPTS.indexOf(playerPoints) + 1;
									if(startersPTS[0] == playerPoints) {
										topStarter = true;
									}
								} else {
									benched = true;
									topStarter = false;
									starterRank = 0;
								}
								
								// idea for dupe check is to push unique info into array the first time the playerID is seen (so you can later check array for dupes)
								let isDuplicate = new Boolean (false);
								let playerInfo = playersInfo[playerID];
								let duplicateCheck = {
									fn: playerInfo.fn,
									ln: playerInfo.ln,
									pos: playerInfo.pos,
									t: playerInfo.t,
								}
								if(!duplicateKeyArr[opponent.recordManID]) {
									duplicateKeyArr[opponent.recordManID] = [];
								}
								if(!POplayerRecords[year][opponent.recordManID][playerID]) {
									POplayerRecords[year][opponent.recordManID][playerID] = [];
									duplicateKeyArr[opponent.recordManID].push(duplicateCheck);
								}
								// duplicateKeyArr[recordManID].forEach(str => isDuplicate[str] ? alert(str) : isDuplicate[str] = true);
								// DUPE CHECK NOT COMPLETE/WORKING (& not entirely sure if necessary)
			
								const playerEntry = {		
									recordManID: opponent.recordManID,
									manager: originalManagers[opponent.recordManID],
									week: POstartWeek,
									year,
									rosterID: opponent.rosterID,
									playerID,
									playerPoints,
									benched,
									howAcquired: null,
									weekAcquired: null,
									topStarter,
									starterRank,
									playerInfo,
									isDuplicate,
								}
			
								// right now, acquisitions is just a list of the manager's draft picks
								let acquisitions = acquisitionRecords[year][opponent.recordManID];
								for(let i = 0; i < acquisitions.length; i++) {
									if(acquisitions[i].playerID == playerID) {
										playerEntry.howAcquired = 'draft';
										playerEntry.weekAcquired = 0;
									} 
								}
								
								POplayerRecords[year][opponent.recordManID][playerID].push(playerEntry);
							}
						}
	
						playoffRosterRecords[home.recordManID].years[year].fptsAgainst += away.fpts;
						playoffRosterRecords[away.recordManID].years[year].fptsAgainst += home.fpts;
	
						if(POmatchupDifferential.differential == 0) {
							playoffRosterRecords[home.recordManID].years[year].ties++;
							playoffRosterRecords[away.recordManID].years[year].ties++;
						} else {
							playoffRosterRecords[home.recordManID].years[year].wins++;
							playoffRosterRecords[away.recordManID].years[year].losses++;
						}
					}
				}

				POstartWeek--;

			}

			if(!playoffPlayerRecords[year]) {
				playoffPlayerRecords[year] = {};
			}
			if(!playoffTeamPOSRecords[year]) {
				playoffTeamPOSRecords[year] = {};
			}

						// create team/pos objects, setting baseline at 0
			for(const recordManID in POplayerRecords[year]) {
				const POplayerRecord = POplayerRecords[year][recordManID];

				let	positionFPTS = {
					QB: 0,
					RB: 0,
					WR: 0,
					TE: 0,
					K: 0,
					DEF: 0,
				};
				let	teamFPTS = {
					ARI: 0,
					ATL: 0,
					BAL: 0,
					BUF: 0,
					CAR: 0,
					CHI: 0,
					CIN: 0,
					CLE: 0,
					DAL: 0,
					DEN: 0,
					DET: 0,
					GB: 0,
					HOU: 0,
					IND: 0,
					JAX: 0,
					KC: 0,
					LAC: 0,
					LAR: 0,
					LV: 0,
					MIA: 0,
					MIN: 0,
					NE: 0,
					NO: 0,
					NYG: 0,
					NYJ: 0,
					PHI: 0,
					PIT: 0,
					SEA: 0,
					SF: 0,
					TEN: 0,
					TB: 0,
					WAS: 0,
				};

				let playerPOWeekBest = 0;
				let playerPOWeekMissedBest = 0;
				let weekBestPlayer = null;

				// NOTE: May need to remove duplicates (if any, eg., due to players changing IDs mid-season) before this point (otherwise they'd count twice towards totals)
				for(const playerID in POplayerRecord) {
					const playRec = POplayerRecord[playerID];

					for(const key in playRec) {
						const play = playRec[key];
						
						if(play.playerPoints > playerPOWeekBest && play.benched == false) {
							playerPOWeekBest = play.playerPoints;

							if(!playerPOWeekEfforts[recordManID]) {
								playerPOWeekEfforts[recordManID] = [];
							}
							playerPOWeekEfforts[recordManID].push(playRec[key]);
						}
						
						if(play.playerPoints > playerPOWeekMissedBest && play.benched == true) {
							playerPOWeekMissedBest = play.playerPoints;

							if(!playerPOWeekMissedEfforts[recordManID]) {
								playerPOWeekMissedEfforts[recordManID] = [];
							}
							playerPOWeekMissedEfforts[recordManID].push(playRec[key]);
						}
					}
				}

				for(const playerID in POplayerRecord) {
					const playRec = POplayerRecord[playerID];
					// // single-week ranks & records
		
					for(let i = 0; i < playRec.length; i++) {
						
						// grab every player's score every week for season & all-time single-week records
						const pPOWTEntry = {
							playerInfo: playRec[i].playerInfo,
							playerID,
							fpts: playRec[i].playerPoints,
							manager: playRec[i].manager,
							recordManID,
							year: playRec[i].year,
							week: playRec[i].week
						}

						if(playRec[i].benched == false) {
							playerPOWeekTOPS.push(pPOWTEntry);
							playerATPOWeekTOPS.push(pPOWTEntry);
						}
					}
					
					// season-long ranks & records

					let weeksStarted = 0; 			// # of weeks manager started player
					let	numWeeksOwned = 0;			// # of weeks manager owned player
					let	whichWeeksOwned = [];		// array of weeks when manager owned player
					let	playerFPTSscored = 0;		// total (season) FPTS player scored as a starter for manager
					let playerFPTSposs = 0;			// total (season) FPTS player scored while on manager's roster (ie. including when on bench)
					let	totalTopStarter = 0;		// # of weeks where player was the manager's highest-scoring starter

					numWeeksOwned = playRec.length;

					for(let i = 0; i < playRec.length; i++) {

						playerFPTSposs += playRec[i].playerPoints;
						whichWeeksOwned.push(playRec[i].week);

						if(playRec[i].benched == false) {

							weeksStarted++;
							playerFPTSscored += playRec[i].playerPoints;

							teamFPTS[playRec[i].playerInfo.t] += playRec[i].playerPoints;
							positionFPTS[playRec[i].playerInfo.pos] += playRec[i].playerPoints;

							if(playRec[i].topStarter == true) {
								totalTopStarter++;
							}
						}
					}

					if(!playoffPlayerRecords[year][recordManID]) {
						playoffPlayerRecords[year][recordManID] = {};
					}
					if(!playoffPlayerRecords[year][recordManID][playerID]) {
						playoffPlayerRecords[year][recordManID][playerID] = {	
							recordManID,
							playerID,
							manager: originalManagers[recordManID],
							playerInfo: playersInfo[playerID],
							year,
							weeksStarted,
							numWeeksOwned,
							whichWeeksOwned,
							playerFPTSscored,
							playerFPTSposs,
							totalTopStarter,
						}
					}
				}

				if(!playoffTeamPOSRecords[year][recordManID]) {
					playoffTeamPOSRecords[year][recordManID] = {
						positionFPTS,
						teamFPTS,
						manager: originalManagers[recordManID],
						recordManID,
						year,
					}
				}
			}	

			for(const recordManID in playerPOWeekEfforts) {
				const playerPOWeekEffort = playerPOWeekEfforts[recordManID];
				const pPOWBest = playerPOWeekEffort[playerPOWeekEffort.length - 1];
	
				const pPOWBEntry = {
					playerInfo: pPOWBest.playerInfo,
					playerID: pPOWBest.playerID,
					fpts: pPOWBest.playerPoints,
					manager: pPOWBest.manager,
					recordManID: pPOWBest.recordManID,
					year: pPOWBest.year,
					week: pPOWBest.week,
				};
	
				playerPOWeekBests.push(pPOWBEntry);
	
				if(!playerATPOWeekRecords[recordManID]){
					playerATPOWeekRecords[recordManID] = [];
				}
				playerATPOWeekRecords[recordManID].push(pPOWBEntry);
			}

			for(const recordManID in playerPOWeekMissedEfforts) {
				const playerPOWeekMissedEffort = playerPOWeekMissedEfforts[recordManID];
				const pPOWBest = playerPOWeekMissedEffort[playerPOWeekMissedEffort.length - 1];
	
				const pPOWMBEntry = {
					playerInfo: pPOWBest.playerInfo,
					playerID: pPOWBest.playerID,
					fpts: pPOWBest.playerPoints,
					manager: pPOWBest.manager,
					recordManID: pPOWBest.recordManID,
					year: pPOWBest.year,
					week: pPOWBest.week,
				};
	
				playerPOWeekMissedBests.push(pPOWMBEntry);
	
				if(!playerATPOWeekMissedRecords[recordManID]){
					playerATPOWeekMissedRecords[recordManID] = [];
				}
				playerATPOWeekMissedRecords[recordManID].push(pPOWMBEntry);
			}

						// create playoff-record arrays 
			let POweekBests = [];						// ranking all managers' personal best week of season
			let POweekWorsts = [];					// ranking......personal worst.....
			let playoffBests = [];					// ranking all managers' personal season-long top scores
			let playoffWorsts = [];					// ranking......personal lows......
			let playoffEPERecords = [];				// ranking all managers' personal season-long EPE stats
			let playerPlayoffTOPS = [];				// top 10 player season-long scores
			let	playerPlayoffBests = [];				// ranking all manager's highest-scoring player (season)

						// calculate playoff records
			for(const recordManID in playoffPlayerRecords[year]) {
				const playoffPlayerRecord = playoffPlayerRecords[year][recordManID];
				let playerPlayoffBest = 0;
				let playoffBestPlayer = null;

				for(const playerID in playoffPlayerRecord) {
					const player = playoffPlayerRecord[playerID];
					
					let fptspg;
					if(player.weeksStarted > 0) {
						fptspg = player.playerFPTSscored / player.weeksStarted;
					} else {
						fptspg = 0;
					}

					const pPTEntry = {
						playerInfo: player.playerInfo,
						playerID,
						fpts: player.playerFPTSscored,
						weeksStarted: player.weeksStarted,
						fptspg,
						totalTopStarter: player.totalTopStarter,
						manager: player.manager,
						recordManID,
						year,
					}
					playerPlayoffTOPS.push(pPTEntry);
					playerATPlayoffTOPS.push(pPTEntry);
				}

				for(const key in playoffPlayerRecord) {
					const player = playoffPlayerRecord[key];

					if(player.playerFPTSscored > playerPlayoffBest) {
						playerPlayoffBest = player.playerFPTSscored;
						playoffBestPlayer = player.playerID;
					}
				}

				const fptspg = playerPlayoffBest / playoffPlayerRecord[playoffBestPlayer].weeksStarted;

				let pPBEntry = {
					playerInfo: playoffPlayerRecord[playoffBestPlayer].playerInfo,
					playerID: playoffPlayerRecord[playoffBestPlayer].playerID,
					fpts: playerPlayoffBest,
					weeksStarted: playoffPlayerRecord[playoffBestPlayer].weeksStarted,
					fptspg,
					totalTopStarter: playoffPlayerRecord[playoffBestPlayer].totalTopStarter,
					manager: playoffPlayerRecord[playoffBestPlayer].manager,
					recordManID,
					year,
				}

				playerPlayoffBests.push(pPBEntry);

				if(!playerATPlayoffRecords[recordManID]) {
					playerATPlayoffRecords[recordManID] = [];
				}
				playerATPlayoffRecords[recordManID].push(pPBEntry);
			}

			for(const recordManID in playoffRosterRecords) {
				const playoffRosterRecord = playoffRosterRecords[recordManID];

				if(playoffRosterRecord.years[year] && playoffRosterRecord.years[year].POgames > 0) {

					playoffRosterRecord.fptsFor += playoffRosterRecord.years[year].fpts;
					playoffRosterRecord.fptsAgainst += playoffRosterRecord.years[year].fptsAgainst;
					playoffRosterRecord.wins += playoffRosterRecord.years[year].wins;
					playoffRosterRecord.ties += playoffRosterRecord.years[year].ties;
					playoffRosterRecord.losses += playoffRosterRecord.years[year].losses;
					playoffRosterRecord.POgames += playoffRosterRecord.years[year].POgames;
					playoffRosterRecord.potentialPoints += playoffRosterRecord.years[year].potentialPoints;
				
					const fptspg = playoffRosterRecord.years[year].fpts / playoffRosterRecord.years[year].POgames;

					const POlongEntry = {
						recordManID,
						fpts: playoffRosterRecord.years[year].fpts,
						fptspg,
						manager: playoffRosterRecord.years[year].manager,
						year,
					}

					mostPlayoffLongPoints.push(POlongEntry);
					if(leagueData.status == 'complete' || startWeek > POrecordsWeek + playoffLength) {
						leastPlayoffLongPoints.push(POlongEntry);
					}

				} else {
					continue;
				}
			}

			for(const recordManID in indivPOweeks) {
				const indivPOweek = indivPOweeks[recordManID];
				let PObestweekfpts = 0;
				let POworstweekfpts = 1000;
	
				let POtotalfpts = 0;
				let POtotalEPEWins = 0;
				let POtotalEPETies = 0;
				let POtotalEPELosses = 0;
				let POtotalWeekWinners = 0;
				let POtotalWeekLosers = 0;
	
				let PObestWeek = {
					fpts: [],
					week: [],
					year: [],
					manager: [],
					recordManID: [],
				};
				let POworstWeek = {
					fpts: [],
					week: [],
					year: [],
					manager: [],
					recordManID: [],
				};
	
				// going through every week for this roster
				for(let i = 0; i < indivPOweek.length; i++) {
					// check if this week's score is the best of roster's season; if so, set that as the new best score and grab the data from that week
					// need to add logic for (unlikely) scenario where you tie your own best/worst score
					if(indivPOweek[i].fpts > PObestweekfpts) {
						PObestweekfpts = indivPOweek[i].fpts;
						PObestWeek = {
							fpts: indivPOweek[i].fpts,
							week: indivPOweek[i].week,
							year: indivPOweek[i].year,
							manager: indivPOweek[i].manager,
							recordManID: indivPOweek[i].recordManID,
						};
					}
					// check if this week's score is the worst of roster's season; if so, set and grab
					if(indivPOweek[i].fpts < POworstweekfpts) {
						POworstweekfpts = indivPOweek[i].fpts;
						POworstWeek = {
							fpts: indivPOweek[i].fpts,
							week: indivPOweek[i].week,
							year: indivPOweek[i].year,
							manager: indivPOweek[i].manager,
							recordManID: indivPOweek[i].recordManID,
						};				
					}
	
					// compare roster's score to every score that week to determine whom they "beat", "tie", or "lose" to
					// note that fptsWeeks goes forward from week 1 while indivweek goes backward from the last played week 
					for( let x = 0; x < POfptsWeeks[indivPOweek[i].week].length; x++) {
						if (indivPOweek[i].fpts > POfptsWeeks[indivPOweek[i].week][x]) {
							indivPOweek[i].epePOWins++;
						} else if (indivPOweek[i].fpts == POfptsWeeks[indivPOweek[i].week][x]) {
							indivPOweek[i].epePOTies++;
						} else {
							indivPOweek[i].epePOLosses++;
						}
					}
	
					// reduce epeTies by one every week to account for the roster "tying" its own score
					indivPOweek[i].epePOTies--;
	
					// determine if roster was the highest or lowest scorer that week
					// needs logic for (unlikely) scenario where you tie someone else for first/last place that week
					if (indivPOweek[i].epePOWins == POfptsWeeks[indivPOweek[i].week].length - 1) {
						indivPOweek[i].POweekWinner = true;
						POtotalWeekWinners++;
					} else if (indivPOweek[i].epePOWins == 0) {
						indivPOweek[i].POweekLoser = true;
						POtotalWeekLosers++;
					}
	
					// add that week's fpts & EPE stats to the roster's running total for the season
					POtotalfpts += indivPOweek[i].fpts;
					POtotalEPEWins += indivPOweek[i].epePOWins;
					POtotalEPETies += indivPOweek[i].epePOTies;
					POtotalEPELosses += indivPOweek[i].epePOLosses;
					
				}
	
				// calculate roster's season-long PPG & EPE Win %
				const POtotalfptspg = POtotalfpts / indivPOweek.length; 
				const POtotalEPEWinPercentage = (POtotalEPEWins + POtotalEPETies / 2) / (POtotalEPEWins + POtotalEPETies + POtotalEPELosses) * 100;
	
				const POweekEntry = {
					fptsBest: {PObestWeek},
					fptsWorst: {POworstWeek},
					POtotalfpts,
					POtotalfptspg,
					POtotalEPELosses,
					POtotalEPETies,
					POtotalEPEWins,
					POtotalEPEWinPercentage,
					POtotalWeekWinners,
					POtotalWeekLosers,
					recordManID,
					manager: originalManagers[recordManID],
					year,
				};
	
				const playoffEntry = {
					fpts: POtotalfpts,
					fptspg: POtotalfptspg,
					recordManID,
					manager: originalManagers[recordManID],
					year,
				};
	
				const playoffEPEEntry = {
					epeL: POtotalEPELosses,
					epeT: POtotalEPETies,
					epeW: POtotalEPEWins,
					epePerc: POtotalEPEWinPercentage,
					weekWin: POtotalWeekWinners,
					weekLoss: POtotalWeekLosers,
					recordManID,
					manager: originalManagers[recordManID],
					year,
				};
	
				if(!individualPOWeekRecords[recordManID]) {
					individualPOWeekRecords[recordManID] = [];
				}
				individualPOWeekRecords[recordManID].push(POweekEntry);
	
				POweekBests.push(PObestWeek);
				POweekWorsts.push(POworstWeek);
	
				playoffBests.push(playoffEntry);
				playoffWorsts.push(playoffEntry);
	
				playoffEPERecords.push(playoffEPEEntry);
			}
			
			POweekBests = POweekBests.sort((a, b) => b.fpts - a.fpts);
			POweekWorsts = POweekWorsts.sort((a, b) => b.fpts - a.fpts);
			playoffBests = playoffBests.sort((a, b) => b.fptspg - a.fptspg);
			playoffWorsts = playoffWorsts.sort((a, b) => b.fptspg - a.fptspg);
			playoffEPERecords = playoffEPERecords.sort((a, b) => b.epePerc - a.epePerc);

			playerPlayoffTOPS = playerPlayoffTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
			playerPlayoffBests = playerPlayoffBests.sort((a, b) => b.fpts - a.fpts);
			playerPOWeekTOPS = playerPOWeekTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
			playerPOWeekBests = playerPOWeekBests.sort((a, b) => b.fpts - a.fpts);
			playerPOWeekMissedBests = playerPOWeekMissedBests.sort((a, b) => b.fpts - a.fpts);

			POmatchupDifferentials = POmatchupDifferentials.sort((a, b) => b.differential - a.differential);
			const biggestPOBlowouts = POmatchupDifferentials.slice(0, 10);

			const closestPOMatchups = [];
			for(let i = 0; i < 10; i++) {
				closestPOMatchups.push(POmatchupDifferentials.pop());
			}

			// per-season ranks & records to push thru seasonWeekRecords
			const interSeasonPOEntry = {
				year,
				biggestPOBlowouts,
				closestPOMatchups,
				POweekBests,
				POweekWorsts,
				playoffBests,
				playoffWorsts,
				playoffEPERecords,
				playerPlayoffTOPS,
				playerPlayoffBests,
				playerPOWeekTOPS,
				playerPOWeekBests,
				playerPOWeekMissedBests,
				playoffPointsRecords: playoffPointsRecord.sort((a, b) => b.fpts - a.fpts).slice(0, 10),
				playoffPointsLows: playoffPointsLow.sort((a, b) => a.fpts - b.fpts).slice(0, 10)
			}

			if(interSeasonPOEntry.playoffPointsRecords.length > 0) {
				if(!currentYear) {
					currentYear = year;
				}
				playoffWeekRecords.push(interSeasonPOEntry);
			};
		}
		
		// process all the REGULAR SEASON matchups
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

				const players = matchup.players;
				const playersPTS = matchup.players_points;
				
				for(let i = 0; i < players.length; i++) {

					const playerID = players[i];

					if(!playerRecords[year]) {
						playerRecords[year] = {};
					}
					if(!playerRecords[year][recordManID]) {
						playerRecords[year][recordManID] = {};
					}

					const playerPoints = playersPTS[playerID];

					let topStarter = new Boolean (false);
					let starterRank;
					let benched = new Boolean (true);

					if(starters.includes(playerID)) {
						benched = false;
						starterRank = startersPTS.indexOf(playerPoints) + 1;
						if(startersPTS[0] == playerPoints) {
							topStarter = true;
						}
					} else {
						benched = true;
						topStarter = false;
						starterRank = 0;
					}
					
					// idea for dupe check is to push unique info into array the first time the playerID is seen (so you can later check array for dupes)
					let isDuplicate = new Boolean (false);
					let playerInfo = playersInfo[playerID];
					let duplicateCheck = {
						fn: playerInfo.fn,
						ln: playerInfo.ln,
						pos: playerInfo.pos,
						t: playerInfo.t,
					}
					if(!duplicateKeyArr[recordManID]) {
						duplicateKeyArr[recordManID] = [];
					}
					if(!playerRecords[year][recordManID][playerID]) {
						playerRecords[year][recordManID][playerID] = [];
						duplicateKeyArr[recordManID].push(duplicateCheck);
					}
					// duplicateKeyArr[recordManID].forEach(str => isDuplicate[str] ? alert(str) : isDuplicate[str] = true);
					// DUPE CHECK NOT COMPLETE/WORKING (& not entirely sure if necessary)

					const playerEntry = {		
						recordManID,
						manager: originalManagers[recordManID],
						week: startWeek,
						year,
						rosterID: matchup.roster_id,
						playerID,
						playerPoints,
						benched,
						howAcquired: null,
						weekAcquired: null,
						topStarter,
						starterRank,
						playerInfo,
						isDuplicate,
					}

					// right now, acquisitions is just a list of the manager's draft picks
					let acquisitions = acquisitionRecords[year][recordManID];
					for(let i = 0; i < acquisitions.length; i++) {
						if(acquisitions[i].playerID == playerID) {
							playerEntry.howAcquired = 'draft';
							playerEntry.weekAcquired = 0;
						} 
					}
					
					playerRecords[year][recordManID][playerID].push(playerEntry);
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

		// first time around, create per-season objects for season-long player & team/pos records
		if(!seasonPlayerRecords[year]) {
			seasonPlayerRecords[year] = {};
		}
		if(!seasonTeamPOSRecords[year]) {
			seasonTeamPOSRecords[year] = {};
		}

		// create team/pos objects, setting baseline at 0
		for(const recordManID in playerRecords[year]) {
			const playerRecord = playerRecords[year][recordManID];

			let	positionFPTS = {
				QB: 0,
				RB: 0,
				WR: 0,
				TE: 0,
				K: 0,
				DEF: 0,
			};
			let	teamFPTS = {
				ARI: 0,
				ATL: 0,
				BAL: 0,
				BUF: 0,
				CAR: 0,
				CHI: 0,
				CIN: 0,
				CLE: 0,
				DAL: 0,
				DEN: 0,
				DET: 0,
				GB: 0,
				HOU: 0,
				IND: 0,
				JAX: 0,
				KC: 0,
				LAC: 0,
				LAR: 0,
				LV: 0,
				MIA: 0,
				MIN: 0,
				NE: 0,
				NO: 0,
				NYG: 0,
				NYJ: 0,
				PHI: 0,
				PIT: 0,
				SEA: 0,
				SF: 0,
				TEN: 0,
				TB: 0,
				WAS: 0,
			};

			let playerWeekBest = 0;
			let playerWeekMissedBest = 0;
			let weekBestPlayer = null;

			// NOTE: May need to remove duplicates (if any, eg., due to players changing IDs mid-season) before this point (otherwise they'd count twice towards totals)
			for(const playerID in playerRecord) {
				const playRec = playerRecord[playerID];

				for(const key in playRec) {
					const play = playRec[key];
					
					if(play.playerPoints > playerWeekBest && play.benched == false) {
						playerWeekBest = play.playerPoints;

						if(!playerWeekEfforts[recordManID]) {
							playerWeekEfforts[recordManID] = [];
						}
						playerWeekEfforts[recordManID].push(playRec[key]);
					}

					if(play.playerPoints > playerWeekMissedBest && play.benched == true) {
						playerWeekMissedBest = play.playerPoints;

						if(!playerWeekMissedEfforts[recordManID]) {
							playerWeekMissedEfforts[recordManID] = [];
						}
						playerWeekMissedEfforts[recordManID].push(playRec[key]);
					}
				}
			}

			for(const playerID in playerRecord) {
				const playRec = playerRecord[playerID];
				// // single-week ranks & records
	
				for(let i = 0; i < playRec.length; i++) {
					
					// grab every player's score every week for season & all-time single-week records
					const pWTEntry = {
						playerInfo: playRec[i].playerInfo,
						playerID,
						fpts: playRec[i].playerPoints,
						manager: playRec[i].manager,
						recordManID,
						year: playRec[i].year,
						week: playRec[i].week
					}

					if(playRec[i].benched == false) {
						playerWeekTOPS.push(pWTEntry);
						playerATWeekTOPS.push(pWTEntry);
					}
				}
				
				// season-long ranks & records

				let weeksStarted = 0; 			// # of weeks manager started player
				let	numWeeksOwned = 0;			// # of weeks manager owned player
				let	whichWeeksOwned = [];		// array of weeks when manager owned player
				let	playerFPTSscored = 0;		// total (season) FPTS player scored as a starter for manager
				let playerFPTSposs = 0;			// total (season) FPTS player scored while on manager's roster (ie. including when on bench)
				let	totalTopStarter = 0;		// # of weeks where player was the manager's highest-scoring starter

				numWeeksOwned = playRec.length;

				for(let i = 0; i < playRec.length; i++) {

					playerFPTSposs += playRec[i].playerPoints;
					whichWeeksOwned.push(playRec[i].week);

					if(playRec[i].benched == false) {

						weeksStarted++;
						playerFPTSscored += playRec[i].playerPoints;

						teamFPTS[playRec[i].playerInfo.t] += playRec[i].playerPoints;
						positionFPTS[playRec[i].playerInfo.pos] += playRec[i].playerPoints;

						if(playRec[i].topStarter == true) {
							totalTopStarter++;
						}
					}
				}

				if(!seasonPlayerRecords[year][recordManID]) {
					seasonPlayerRecords[year][recordManID] = {};
				}
				if(!seasonPlayerRecords[year][recordManID][playerID]) {
					seasonPlayerRecords[year][recordManID][playerID] = {	
						recordManID,
						playerID,
						manager: originalManagers[recordManID],
						playerInfo: playersInfo[playerID],
						year,
						weeksStarted,
						numWeeksOwned,
						whichWeeksOwned,
						playerFPTSscored,
						playerFPTSposs,
						totalTopStarter,
					}
				}
			}

			if(!seasonTeamPOSRecords[year][recordManID]) {
				seasonTeamPOSRecords[year][recordManID] = {
					positionFPTS,
					teamFPTS,
					manager: originalManagers[recordManID],
					recordManID,
					year,
				}
			}
		}	
		
		for(const recordManID in playerWeekEfforts) {
			const playerWeekEffort = playerWeekEfforts[recordManID];
			const pWBest = playerWeekEffort[playerWeekEffort.length - 1];

			const pWBEntry = {
				playerInfo: pWBest.playerInfo,
				playerID: pWBest.playerID,
				fpts: pWBest.playerPoints,
				manager: pWBest.manager,
				recordManID: pWBest.recordManID,
				year: pWBest.year,
				week: pWBest.week,
			};

			playerWeekBests.push(pWBEntry);

			if(!playerATWeekRecords[recordManID]){
				playerATWeekRecords[recordManID] = [];
			}
			playerATWeekRecords[recordManID].push(pWBEntry);
		}

		for(const recordManID in playerWeekMissedEfforts) {
			const playerWeekMissedEffort = playerWeekMissedEfforts[recordManID];
			const pWMBest = playerWeekMissedEffort[playerWeekMissedEffort.length - 1];

			const pWMBEntry = {
				playerInfo: pWMBest.playerInfo,
				playerID: pWMBest.playerID,
				fpts: pWMBest.playerPoints,
				manager: pWMBest.manager,
				recordManID: pWMBest.recordManID,
				year: pWMBest.year,
				week: pWMBest.week,
			};

			playerWeekMissedBests.push(pWMBEntry);

			if(!playerATWeekMissedRecords[recordManID]) {
				playerATWeekMissedRecords[recordManID] = [];
			}
			playerATWeekMissedRecords[recordManID].push(pWMBEntry);
		}
		
		// create season-record arrays 
		let weekBests = [];						// ranking all managers' personal best week of season
		let weekWorsts = [];					// ranking......personal worst.....
		let seasonBests = [];					// ranking all managers' personal season-long top scores
		let seasonWorsts = [];					// ranking......personal lows......
		let seasonEPERecords = [];				// ranking all managers' personal season-long EPE stats
		let playerSeasonTOPS = [];				// top 10 player season-long scores
		let	playerSeasonBests = [];				// ranking all manager's highest-scoring player (season)

		// calculate season records
		for(const recordManID in seasonPlayerRecords[year]) {
			const seasonPlayerRecord = seasonPlayerRecords[year][recordManID];
			let playerSeasonBest = 0;
			let seasonBestPlayer = null;

			for(const playerID in seasonPlayerRecord) {
				const player = seasonPlayerRecord[playerID];
				const fptspg = player.playerFPTSscored / player.weeksStarted

				const pSTEntry = {
					playerInfo: player.playerInfo,
					playerID,
					fpts: player.playerFPTSscored,
					weeksStarted: player.weeksStarted,
					fptspg,
					totalTopStarter: player.totalTopStarter,
					manager: player.manager,
					recordManID,
					year,
				}
				playerSeasonTOPS.push(pSTEntry);
				playerATSeasonTOPS.push(pSTEntry);
			}

			for(const key in seasonPlayerRecord) {
				const player = seasonPlayerRecord[key];

				if(player.playerFPTSscored > playerSeasonBest) {
					playerSeasonBest = player.playerFPTSscored;
					seasonBestPlayer = player.playerID;
				}
			}

			const fptspg = playerSeasonBest / seasonPlayerRecord[seasonBestPlayer].weeksStarted;

			let pSBEntry = {
				playerInfo: seasonPlayerRecord[seasonBestPlayer].playerInfo,
				playerID: seasonPlayerRecord[seasonBestPlayer].playerID,
				fpts: playerSeasonBest,
				weeksStarted: seasonPlayerRecord[seasonBestPlayer].weeksStarted,
				fptspg,
				totalTopStarter: seasonPlayerRecord[seasonBestPlayer].totalTopStarter,
				manager: seasonPlayerRecord[seasonBestPlayer].manager,
				recordManID,
				year,
			}

			playerSeasonBests.push(pSBEntry);

			if(!playerATSeasonRecords[recordManID]) {
				playerATSeasonRecords[recordManID] = [];
			}
			playerATSeasonRecords[recordManID].push(pSBEntry);
		}

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

		playerSeasonTOPS = playerSeasonTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
		playerSeasonBests = playerSeasonBests.sort((a, b) => b.fpts - a.fpts);
		playerWeekTOPS = playerWeekTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
		playerWeekBests = playerWeekBests.sort((a, b) => b.fpts - a.fpts);
		playerWeekMissedBests = playerWeekMissedBests.sort((a, b) => b.fpts - a.fpts);

		matchupDifferentials = matchupDifferentials.sort((a, b) => b.differential - a.differential);
		const biggestBlowouts = matchupDifferentials.slice(0, 10);

		const closestMatchups = [];
		for(let i = 0; i < 10; i++) {
			closestMatchups.push(matchupDifferentials.pop());
		}

		// per-season ranks & records to push thru seasonWeekRecords
		const interSeasonEntry = {
			year,
			biggestBlowouts,
			closestMatchups,
			weekBests,
			weekWorsts,
			seasonBests,
			seasonWorsts,
			seasonEPERecords,
			playerSeasonTOPS,
			playerSeasonBests,
			playerWeekTOPS,
			playerWeekBests,
			playerWeekMissedBests,
			seasonPointsRecords: seasonPointsRecord.sort((a, b) => b.fpts - a.fpts).slice(0, 10),
			seasonPointsLows: seasonPointsLow.sort((a, b) => a.fpts - b.fpts).slice(0, 10)
		}

		if(interSeasonEntry.seasonPointsRecords.length > 0) {
			if(!currentYear) {
				currentYear = year;
			}
			seasonWeekRecords.push(interSeasonEntry);
		};
		
	} // SEASON LOOPS HERE

	// calculating all-time player records - REGULAR SEASON
	for(const recordManID in playerATWeekRecords) {
		const season = playerATWeekRecords[recordManID];

		let playerATWeekBest = 0;
		let ATBestKey = null;

		for(let i = 0; i < season.length; i++) {
			if(season[i].fpts > playerATWeekBest) {
				playerATWeekBest = season[i].fpts;
				ATBestKey = i;
			}
		}

		let pATWBEntry = {
			playerInfo: season[ATBestKey].playerInfo,
			playerID: season[ATBestKey].playerID,
			fpts: season[ATBestKey].fpts,
			manager: season[ATBestKey].manager,
			recordManID: season[ATBestKey].recordManID,
			year: season[ATBestKey].year,
			week: season[ATBestKey].week,
		};

		playerATWeekBests.push(pATWBEntry);

	}

	for(const recordManID in playerATWeekMissedRecords) {
		const season = playerATWeekMissedRecords[recordManID];

		let playerATWeekMissedBest = 0;
		let ATBestKey = null;

		for(let i = 0; i < season.length; i++) {
			if(season[i].fpts > playerATWeekMissedBest) {
				playerATWeekMissedBest = season[i].fpts;
				ATBestKey = i;
			}
		}

		let pATWMBEntry = {
			playerInfo: season[ATBestKey].playerInfo,
			playerID: season[ATBestKey].playerID,
			fpts: season[ATBestKey].fpts,
			manager: season[ATBestKey].manager,
			recordManID: season[ATBestKey].recordManID,
			year: season[ATBestKey].year,
			week: season[ATBestKey].week,
		};

		playerATWeekMissedBests.push(pATWMBEntry);

	}

	for(const recordManID in playerATSeasonRecords) {
		const season = playerATSeasonRecords[recordManID];

		let playerATSeasonBest = 0;
		let ATBestKey = null;

		for(let i = 0; i < season.length; i++) {

			if(season[i].fpts > playerATSeasonBest) {
				playerATSeasonBest = season[i].fpts;
				ATBestKey = i;
			}
		}

		const fptspg = season[ATBestKey].fpts / season[ATBestKey].weeksStarted;

		let pATSBEntry = {
			playerInfo: season[ATBestKey].playerInfo,
			playerID: season[ATBestKey].playerID,
			fpts: season[ATBestKey].fpts,
			weeksStarted: season[ATBestKey].weeksStarted,
			fptspg,
			totalTopStarter: season[ATBestKey].totalTopStarter,
			manager: season[ATBestKey].manager,
			recordManID: season[ATBestKey].recordManID,
			year: season[ATBestKey].year,
		};

		playerATSeasonBests.push(pATSBEntry);

	}

	// calculating all-time player records - PLAYOFFS
	for(const recordManID in playerATPOWeekRecords) {
		const season = playerATPOWeekRecords[recordManID];

		let playerATPOWeekBest = 0;
		let ATBestKey = null;

		for(let i = 0; i < season.length; i++) {
			if(season[i].fpts > playerATPOWeekBest) {
				playerATPOWeekBest = season[i].fpts;
				ATBestKey = i;
			}
		}

		let pATPOWBEntry = {
			playerInfo: season[ATBestKey].playerInfo,
			playerID: season[ATBestKey].playerID,
			fpts: season[ATBestKey].fpts,
			manager: season[ATBestKey].manager,
			recordManID: season[ATBestKey].recordManID,
			year: season[ATBestKey].year,
			week: season[ATBestKey].week,
		};

		playerATPOWeekBests.push(pATPOWBEntry);

	}

	for(const recordManID in playerATPOWeekMissedRecords) {
		const season = playerATPOWeekMissedRecords[recordManID];

		let playerATPOWeekMissedBest = 0;
		let ATBestKey = null;

		for(let i = 0; i < season.length; i++) {
			if(season[i].fpts > playerATPOWeekMissedBest) {
				playerATPOWeekMissedBest = season[i].fpts;
				ATBestKey = i;
			}
		}

		let pATPOWMBEntry = {
			playerInfo: season[ATBestKey].playerInfo,
			playerID: season[ATBestKey].playerID,
			fpts: season[ATBestKey].fpts,
			manager: season[ATBestKey].manager,
			recordManID: season[ATBestKey].recordManID,
			year: season[ATBestKey].year,
			week: season[ATBestKey].week,
		};

		playerATPOWeekMissedBests.push(pATPOWMBEntry);

	}

	for(const recordManID in playerATPlayoffRecords) {
		const season = playerATPlayoffRecords[recordManID];

		let playerATPlayoffBest = 0;
		let ATBestKey = null;

		for(let i = 0; i < season.length; i++) {

			if(season[i].fpts > playerATPlayoffBest) {
				playerATPlayoffBest = season[i].fpts;
				ATBestKey = i;
			}
		}

		const fptspg = season[ATBestKey].fpts / season[ATBestKey].weeksStarted;

		let pATPOBEntry = {
			playerInfo: season[ATBestKey].playerInfo,
			playerID: season[ATBestKey].playerID,
			fpts: season[ATBestKey].fpts,
			weeksStarted: season[ATBestKey].weeksStarted,
			fptspg,
			totalTopStarter: season[ATBestKey].totalTopStarter,
			manager: season[ATBestKey].manager,
			recordManID: season[ATBestKey].recordManID,
			year: season[ATBestKey].year,
		};

		playerATPlayoffBests.push(pATPOBEntry);

	}

	// calculating all-time playoff records
	for(const recordManID in individualPOWeekRecords) {
		const individualPOWeekRecord = individualPOWeekRecords[recordManID];

		let allTimeBestPOWeekfpts = 0;
		let allTimeWorstPOWeekfpts = 1000;
		let allTimeBestPlayofffpts = 0;
		let allTimeWorstPlayofffpts = 5000;

		let allTimePOEPEEntry = {
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

		let allTimeBestPOWeek = {
			fpts: [],
			week: [],
			year: [],
			manager: [],
			recordManID: [],
		};
		let allTimeWorstPOWeek = {
			fpts: [],
			week: [],
			year: [],
			manager: [],
			recordManID: [],
		};

		let allTimeBestPlayoff = {
			fpts: [],
			fptspg: [],
			year: [],
			manager: [],
			recordManID: [],
		};

		let allTimeWorstPlayoff = {
			fpts: [],
			fptspg: [],
			year: [],
			manager: [],
			recordManID: [],
		};

		// going through every season for this roster
		for(let i = 0; i < individualPOWeekRecord.length; i++) {

			if(individualPOWeekRecord[i].fptsBest.PObestWeek.fpts > allTimeBestPOWeekfpts) {
				allTimeBestPOWeekfpts = individualPOWeekRecord[i].fptsBest.PObestWeek.fpts;
				allTimeBestPOWeek = {
					fpts: individualPOWeekRecord[i].fptsBest.PObestWeek.fpts,
					week: individualPOWeekRecord[i].fptsBest.PObestWeek.week,
					year: individualPOWeekRecord[i].fptsBest.PObestWeek.year,
					manager: individualPOWeekRecord[i].fptsBest.PObestWeek.manager,
					recordManID: individualPOWeekRecord[i].fptsBest.PObestWeek.recordManID,
				}
			}

			if(individualPOWeekRecord[i].fptsWorst.POworstWeek.fpts < allTimeWorstPOWeekfpts) {
				allTimeWorstPOWeekfpts = individualPOWeekRecord[i].fptsWorst.POworstWeek.fpts;
				allTimeWorstPOWeek = {
					fpts: individualPOWeekRecord[i].fptsWorst.POworstWeek.fpts,
					week: individualPOWeekRecord[i].fptsWorst.POworstWeek.week,
					year: individualPOWeekRecord[i].fptsWorst.POworstWeek.year,
					manager: individualPOWeekRecord[i].fptsWorst.POworstWeek.manager,
					recordManID: individualPOWeekRecord[i].fptsWorst.POworstWeek.recordManID,
				}
			}

			if(individualPOWeekRecord[i].POtotalfpts > allTimeBestPlayofffpts) {
				allTimeBestPlayofffpts = individualPOWeekRecord[i].POtotalfpts;
				allTimeBestPlayoff = {
					fpts: individualPOWeekRecord[i].POtotalfpts,
					fptspg: individualPOWeekRecord[i].POtotalfptspg,
					year: individualPOWeekRecord[i].year,
					manager: individualPOWeekRecord[i].manager,
					recordManID: individualPOWeekRecord[i].recordManID,
				}
			}
				// needs (actual) logic to exclude current season
			if(individualPOWeekRecord[i].POtotalfpts < allTimeWorstPlayofffpts && individualPOWeekRecord[i].year != 2021) {
				allTimeWorstPlayofffpts = individualPOWeekRecord[i].POtotalfpts;
				allTimeWorstPlayoff = {
					fpts: individualPOWeekRecord[i].POtotalfpts,
					fptspg: individualPOWeekRecord[i].POtotalfptspg,
					year: individualPOWeekRecord[i].year,
					manager: individualPOWeekRecord[i].manager,
					recordManID: individualPOWeekRecord[i].recordManID,
				}
			}

			allTimePOEPERecords.epeL += individualPOWeekRecord[i].POtotalEPELosses;
			allTimePOEPERecords.epeT += individualPOWeekRecord[i].POtotalEPETies;
			allTimePOEPERecords.epeW += individualPOWeekRecord[i].POtotalEPEWins;
			allTimePOEPERecords.weekWin += individualPOWeekRecord[i].POtotalWeekWinners;
			allTimePOEPERecords.weekLoss += individualPOWeekRecord[i].POtotalWeekLosers;
			allTimePOEPERecords.recordManID = individualPOWeekRecord[i].recordManID;
			allTimePOEPERecords.manager = individualPOWeekRecord[i].manager;
			allTimePOEPERecords.year = individualPOWeekRecord[i].year;

		}

		allTimePOEPERecords.epePerc = ((allTimePOEPERecords.epeW + allTimePOEPERecords.epeT / 2) / (allTimePOEPERecords.epeW + allTimePOEPERecords.epeT + allTimePOEPERecords.epeL) * 100);

		allTimePOWeekBests.push(allTimeBestPOWeek);
		allTimePOWeekWorsts.push(allTimeWorstPOWeek);
		allTimePlayoffBests.push(allTimeBestPlayoff);
		allTimePlayoffWorsts.push(allTimeWorstPlayoff);

		allTimePOEPERecords.push(allTimePOEPEEntry);

	}
	
	// calculating all-time week/season records
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

	// Sorting - REGULAR SEASON
	allTimeWeekBests = allTimeWeekBests.sort((a, b) => b.fpts - a.fpts);
	allTimeWeekWorsts = allTimeWeekWorsts.sort((a, b) => b.fpts - a.fpts);
	allTimeSeasonBests = allTimeSeasonBests.sort((a, b) => b.fpts - a.fpts);
	allTimeSeasonWorsts = allTimeSeasonWorsts.sort((a, b) => b.fpts - a.fpts);
	playerATSeasonBests = playerATSeasonBests.sort((a, b) => b.fpts - a.fpts);
	playerATWeekBests = playerATWeekBests.sort((a, b) => b.fpts - a.fpts);
	playerATWeekMissedBests = playerATWeekMissedBests.sort((a, b) => b.fpts - a.fpts);

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
	playerATSeasonTOPS = playerATSeasonTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
	playerATWeekTOPS = playerATWeekTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);


	// Sorting - PLAYOFFS
	allTimePOWeekBests = allTimePOWeekBests.sort((a, b) => b.fpts - a.fpts);
	allTimePOWeekWorsts = allTimePOWeekWorsts.sort((a, b) => b.fpts - a.fpts);
	allTimePlayoffBests = allTimePlayoffBests.sort((a, b) => b.fptspg - a.fptspg);
	allTimePlayoffWorsts = allTimePlayoffWorsts.sort((a, b) => b.fptspg - a.fptspg);
	playerATPlayoffBests = playerATPlayoffBests.sort((a, b) => b.fptspg - a.fptspg);
	playerATPOWeekBests = playerATPOWeekBests.sort((a, b) => b.fpts - a.fpts);
	playerATPOWeekMissedBests = playerATPOWeekMissedBests.sort((a, b) => b.fpts - a.fpts);

	allTimePOMatchupDifferentials = allTimePOMatchupDifferentials.sort((a, b) => b.differential - a.differential);
	allTimeBiggestPOBlowouts = allTimePOMatchupDifferentials.slice(0, 10);

	for(let i = 0; i < 10; i++) {
		allTimeClosestPOMatchups.push(allTimePOMatchupDifferentials.pop());
	}

	leaguePOWeekRecords = leaguePOWeekRecords.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
	leaguePOWeekLows = leaguePOWeekLows.sort((a, b) => a.fpts - b.fpts).slice(0, 10);
	mostPlayoffLongPoints = mostPlayoffLongPoints.sort((a, b) => b.fptspg - a.fptspg).slice(0, 10);
	leastPlayoffLongPoints = leastPlayoffLongPoints.sort((a, b) => a.fptspg - b.fptspg).slice(0, 10);
	playerATPlayoffTOPS = playerATPlayoffTOPS.sort((a, b) => b.fptspg - a.fptspg).slice(0, 10);
	playerATPOWeekTOPS = playerATPOWeekTOPS.sort((a, b) => b.fpts - a.fpts).slice(0, 10);

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
		playerATSeasonTOPS,
		playerATSeasonBests,
		playerATWeekTOPS,
		playerATWeekBests,
		playerATWeekMissedBests,
		playerATPlayoffBests,
		playerATPOWeekBests,
		playerATPOWeekMissedBests,
		playerATPOWeekTOPS,
		playerATPlayoffTOPS,
		leagueWeekLows,
		individualWeekRecords,
		individualPOWeekRecords,
		leagueWeekRecords,
		seasonWeekRecords,
		leagueRosterRecords,
		playoffWeekRecords,
		playoffRosterRecords,
		leaguePOWeekRecords,
		leaguePOWeekLows,
		allTimeBiggestPOBlowouts,
		allTimeClosestPOMatchups,
		mostPlayoffLongPoints,
		leastPlayoffLongPoints,
		currentManagers,
		currentYear,
		lastYear
	};

	// update localStorage
	localStorage.setItem("records", JSON.stringify(recordsData));

	records.update(() => recordsData);

	return recordsData;
}