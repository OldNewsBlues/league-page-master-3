<script>
    import {round} from '$lib/utils/helper';
  	import RecordsAndRankings from './RecordsAndRankings.svelte';

    export let leagueRosterRecords, seasonWeekRecords, currentManagers, individualWeekRecords, allTimeWeekBests, allTimeWeekWorsts, allTimeSeasonBests, allTimeSeasonWorsts, allTimeEPERecords, currentYear, lastYear, transactionTotals;

    const yearsObj = {};
    const years = [];

    let loopYear = currentYear;
    while(loopYear >= lastYear) {
        yearsObj[loopYear] = {
            seasonLongRecords: [],
	        seasonLongLows: [],
            winPercentages: [],
            lineupIQs: [],
            fptsHistories: [],
            tradesData: [],
            waiversData: [],
            blowouts: [],
            closestMatchups: [],
            weekBests: [],
            weekWorsts: [],
            seasonBests: [],
            seasonWorsts: [],
            seasonEPERecords: [],
            showTies: false,
            year: loopYear
        }
        loopYear--;
    }

    for(const seasonWeekRecord of seasonWeekRecords) {
        yearsObj[seasonWeekRecord.year].weekRecords = seasonWeekRecord.seasonPointsRecords;
	    yearsObj[seasonWeekRecord.year].weekLows = seasonWeekRecord.seasonPointsLows;
        yearsObj[seasonWeekRecord.year].blowouts = seasonWeekRecord.biggestBlowouts;
        yearsObj[seasonWeekRecord.year].closestMatchups = seasonWeekRecord.closestMatchups;
        yearsObj[seasonWeekRecord.year].weekBests = seasonWeekRecord.weekBests;
        yearsObj[seasonWeekRecord.year].weekWorsts = seasonWeekRecord.weekWorsts;
        yearsObj[seasonWeekRecord.year].seasonBests = seasonWeekRecord.seasonBests;
        yearsObj[seasonWeekRecord.year].seasonWorsts = seasonWeekRecord.seasonWorsts;
        yearsObj[seasonWeekRecord.year].seasonEPERecords = seasonWeekRecord.seasonEPERecords;

    }
    
    for(const season in transactionTotals.seasons) {
        if(!yearsObj[season]) continue;
        for(const recordManID in transactionTotals.seasons[season]) {
            yearsObj[season].tradesData.push({
                recordManID: transactionTotals.seasons[season][recordManID].recordManID,
                manager: transactionTotals.seasons[season][recordManID].manager,
                trades: transactionTotals.seasons[season][recordManID].trade,
            })
            yearsObj[season].waiversData.push({
                recordManID: transactionTotals.seasons[season][recordManID].recordManID,
                manager: transactionTotals.seasons[season][recordManID].manager,
                waivers: transactionTotals.seasons[season][recordManID].waiver,
            })
        }
    }

    for(const recordManID in leagueRosterRecords) {
        const leagueRosterRecord = leagueRosterRecords[recordManID];
        for(const season of leagueRosterRecord.years) {
            // check for ties
            if(season.ties > 0) {
                yearsObj[season.year].showTies = true;
            }

			const fpts = season.fpts;
			const fptspg = season.fpts / (season.wins + season.losses + season.ties);

            // add season-long scoring record
            yearsObj[season.year].seasonLongRecords.push({
                manager: season.manager,
				recordManID,
				fpts,
		    	fptspg,
				year: null,
			})
	        // add season-long scoring low
            yearsObj[season.year].seasonLongLows.push({
                manager: season.manager,
				recordManID,
				fpts,
		    	fptspg,
				year: null,
			})

            // add win percentage rankings
            yearsObj[season.year].winPercentages.push({
                recordManID,
                manager: season.manager,
                percentage: round((season.wins + season.ties / 2) / (season.wins + season.ties + season.losses) * 100),
                wins: season.wins,
                ties: season.ties,
                losses: season.losses,
            })

            // add lineup IQ rankings
            let lineupIQ = {
                recordManID,
                manager: season.manager,
                fpts: round(season.fpts),
            }
            if(season.potentialPoints) {
                lineupIQ.iq = round(season.fpts / season.potentialPoints * 100);
                lineupIQ.potentialPoints = round(season.potentialPoints);
            }

            yearsObj[season.year].lineupIQs.push(lineupIQ)

            // add fantasy points histories
            yearsObj[season.year].fptsHistories.push({
                recordManID,
                manager: season.manager,
                fptsFor: round(season.fpts),
                fptsAgainst: round(season.fptsAgainst),
		        fptsPerGame: round(season.fpts / (season.wins + season.losses + season.ties)),
            })

        }

    }

    for(const key in yearsObj) {
        // sort records
        yearsObj[key].seasonLongRecords = yearsObj[key].seasonLongRecords.sort((a, b) => b.fpts - a.fpts).slice(0, 10);
	    yearsObj[key].seasonLongLows = yearsObj[key].seasonLongLows.sort((a, b) => a.fpts - b.fpts).slice(0, 10);
        
        // sort rankings
        yearsObj[key].winPercentages.sort((a, b) => b.percentage - a.percentage);
        yearsObj[key].lineupIQs.sort((a, b) => b.iq - a.iq);
        yearsObj[key].fptsHistories.sort((a, b) => b.fptsFor - a.fptsFor);
        yearsObj[key].tradesData.sort((a, b) => b.trades - a.trades);
        yearsObj[key].waiversData.sort((a, b) => b.waivers - a.waivers);

        // add to array
        years.push(yearsObj[key]);
    }

    years.sort((a, b) => b.year - a.year);

</script>

{#each years as {waiversData, tradesData, weekRecords, weekLows, seasonLongRecords, seasonLongLows, showTies, winPercentages, fptsHistories, lineupIQs, year, blowouts, closestMatchups, weekBests, weekWorsts, seasonBests, seasonWorsts, allTimeWeekBests, allTimeWeekWorsts, allTimeSeasonBests, allTimeSeasonWorsts, seasonEPERecords}, ix}
    <RecordsAndRankings
        {waiversData}
        {tradesData}
        {weekRecords}
	    {weekLows}
        {seasonLongRecords}
	    {seasonLongLows}
        {showTies}
        {winPercentages}
        {fptsHistories}
        {lineupIQs}
        {blowouts}
        {closestMatchups}
        {weekBests}
        {weekWorsts}
        {seasonBests}
        {seasonWorsts}
        {allTimeWeekBests} 
        {allTimeWeekWorsts}
        {allTimeSeasonBests} 
        {allTimeSeasonWorsts}
        {seasonEPERecords}
        prefix={year}
        {currentManagers}
        {individualWeekRecords}
        last={ix == years.length - 1}
    />
{/each}