<script>
    import {round} from '$lib/utils/helper'
  	import RecordsAndRankings from './RecordsAndRankings.svelte'; 

    export let leagueRosterRecords, leagueWeekRecords, leagueWeekLows, allTimeEPERecords, allTimeBiggestBlowouts, allTimeClosestMatchups, allTimeWeekBests, allTimeWeekWorsts, allTimeSeasonBests, allTimeSeasonWorsts, currentManagers, mostSeasonLongPoints, leastSeasonLongPoints, transactionTotals, individualWeekRecords, playerATSeasonTOPS, playerATSeasonBests, playerATWeekTOPS, playerATWeekBests;

    let winPercentages = [];
    let lineupIQs = [];
    const fptsHistories = [];
    const tradesData = [];
    const waiversData = [];

    let showTies = false;
    
    for(const recordManID in transactionTotals.allTime) {
        tradesData.push({
            recordManID: transactionTotals.allTime[recordManID].recordManID,
            manager: transactionTotals.allTime[recordManID].manager,
            trades: transactionTotals.allTime[recordManID].trade,
        })
        waiversData.push({
            recordManID: transactionTotals.allTime[recordManID].recordManID,
            manager: transactionTotals.allTime[recordManID].manager,
            waivers: transactionTotals.allTime[recordManID].waiver,
        })
    }

    for(const key in leagueRosterRecords) {
        const leagueRosterRecord = leagueRosterRecords[key];
        winPercentages.push({
            recordManID: key,
            manager: leagueRosterRecord.manager,
            percentage: round((leagueRosterRecord.wins + leagueRosterRecord.ties / 2) / (leagueRosterRecord.wins + leagueRosterRecord.ties + leagueRosterRecord.losses) * 100),
            wins: leagueRosterRecord.wins,
            ties: leagueRosterRecord.ties,
            losses: leagueRosterRecord.losses,
        })

        let lineupIQ = {
            recordManID: key,
            manager: leagueRosterRecord.manager,
            fpts: round(leagueRosterRecord.fptsFor),
        }

        if(leagueRosterRecord.potentialPoints) {
            lineupIQ.iq = round(leagueRosterRecord.fptsFor / leagueRosterRecord.potentialPoints * 100);
            lineupIQ.potentialPoints = round(leagueRosterRecord.potentialPoints);
        }

        lineupIQs.push(lineupIQ)
    
        fptsHistories.push({
            recordManID: key,
            manager: leagueRosterRecord.manager,
            fptsFor: round(leagueRosterRecord.fptsFor),
            fptsAgainst: round(leagueRosterRecord.fptsAgainst),
            fptsPerGame: round(leagueRosterRecord.fptsFor / (leagueRosterRecord.wins + leagueRosterRecord.losses + leagueRosterRecord.ties)),
        })
    
        if(leagueRosterRecord.ties > 0) showTies = true;
    }

    winPercentages.sort((a, b) => b.percentage - a.percentage);
    lineupIQs.sort((a, b) => b.iq - a.iq);
    fptsHistories.sort((a, b) => b.fptsFor - a.fptsFor);
    tradesData.sort((a, b) => b.trades - a.trades);
    waiversData.sort((a, b) => b.waivers - a.waivers);
</script>

<RecordsAndRankings
    {currentManagers}   
    blowouts={allTimeBiggestBlowouts}
    closestMatchups={allTimeClosestMatchups}
    weekBests={allTimeWeekBests}
    weekWorsts={allTimeWeekWorsts}
    seasonBests={allTimeSeasonBests} 
    seasonWorsts={allTimeSeasonWorsts}
    weekRecords={leagueWeekRecords}
    weekLows={leagueWeekLows}
    seasonEPERecords={allTimeEPERecords}
    seasonLongRecords={mostSeasonLongPoints}
    playerSeasonTOPS={playerATSeasonTOPS}
    playerSeasonBests={playerATSeasonBests}
    playerWeekTOPS={playerATWeekTOPS}
    playerWeekBests={playerATWeekBests}
    {individualWeekRecords}
    {leastSeasonLongPoints}  
    {showTies}
    {winPercentages}
    {fptsHistories}
    {lineupIQs}
    {tradesData}
    {waiversData}
    prefix="All-Time"
    allTime={true}
/>
