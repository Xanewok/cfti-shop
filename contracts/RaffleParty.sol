// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

import "./IConfetti.sol";
import "./IParty.sol";
import "./IRPSeeder.sol";

/**
 * @title
 * @author xanewok.eth
 * @dev
 */
contract RaffleParty is Context, Ownable, Pausable, AccessControlEnumerable {
    using Strings for uint256;

    IConfetti public immutable _confetti;
    IParty public immutable _party;
    IRpSeeder public immutable _rpSeeder;

    Raffle[] public _raffles;

    string private _baseRaffleURI;

    bytes32 public constant RAFFLE_CREATOR_ROLE =
        keccak256("RAFFLE_CREATOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    event RaffleCreated(uint256 indexed raffleId, address indexed creator);

    struct Raffle {
        uint128 cost;
        uint64 endingSeedRound;
        uint32 maxEntries;
        uint32 totalTicketsBought;
        mapping(address => uint32) ticketsBought;
        address[] participants;
    }

    constructor(
        address confetti,
        address party,
        address rpSeeder,
        string memory baseRaffleURI
    ) {
        _setupRole(RAFFLE_CREATOR_ROLE, owner());
        _setupRole(PAUSER_ROLE, owner());

        _party = IParty(party);
        _confetti = IConfetti(confetti);
        _rpSeeder = IRpSeeder(rpSeeder);
        _baseRaffleURI = baseRaffleURI;
    }

    function createRaffle(
        uint128 cost,
        uint32 maxEntries,
        uint64 endingSeedRound
    )
        public
        // NOTE: cba to add a hot wallet role admin setup so just allow everyone
        // to create raffles during the Rinkeby testing period
        // onlyRole(RAFFLE_CREATOR_ROLE)
        whenNotPaused
    {
        // Mitigate possible front-running - disallow the txn about a minute
        // before the seeder can request randomness. The RP seeder is pre-configured
        // to require 3 block confirmations, so 60 seconds makes sense (< 3 * 14s)
        require(getSeed(endingSeedRound) == 0, "Raffle finished");
        require(
            endingSeedRound > _rpSeeder.getBatch() ||
                _rpSeeder.getNextAvailableBatch() > (block.timestamp + 60),
            "Not enough time before next seed"
        );

        Raffle storage newRaffle = _raffles.push();
        // Max entries being 0 means unlimited raffle tickets
        newRaffle.maxEntries = maxEntries == 0 ? type(uint32).max : maxEntries;
        newRaffle.cost = cost;
        newRaffle.endingSeedRound = endingSeedRound;

        emit RaffleCreated(_raffles.length - 1, _msgSender());
    }

    function buyTickets(uint256 raffleId, uint32 count) public whenNotPaused {
        require(count > 0, "Need to buy at least 1 ticket");
        Raffle storage raffle = getRaffleSafe(raffleId);
        require(getSeed(raffle.endingSeedRound) == 0, "Raffle finished");
        // Mitigate possible front-running - disallow the txn about a minute
        // before the seeder can request randomness. The RP seeder is pre-configured
        // to require 3 block confirmations, so 60 seconds makes sense (< 3 * 14s)
        require(
            raffle.endingSeedRound > _rpSeeder.getBatch() ||
                _rpSeeder.getNextAvailableBatch() > (block.timestamp + 60),
            "Not enough time before next seed"
        );
        // TODO: Investigate making this check dynamic/different per raffle
        require(_party.getUserHero(_msgSender()) != 0, "No hero staked");

        uint32 ticketsLeft = raffle.maxEntries - raffle.totalTicketsBought;
        require(ticketsLeft > 0, "Sold out");
        // We can't buy more tickets than there are left
        uint32 ticketCount = count > ticketsLeft ? ticketsLeft : count;

        uint256 cost = ticketCount * raffle.cost;
        if (cost > 0) {
            _confetti.burnFrom(_msgSender(), cost);
        }
        if (raffle.ticketsBought[_msgSender()] == 0) {
            raffle.participants.push(_msgSender());
        }
        raffle.ticketsBought[_msgSender()] += ticketCount;
        raffle.totalTicketsBought += ticketCount;
    }

    /// @dev This is a naive, expensive version that should be only read off-chain.
    /// This simply creates a shuffled list of raffle ticket winners - the caller
    /// is responsible to handle players that have already won, verify their
    /// eligibility for the raffle and so on.
    function raffleWinners(uint256 raffleId)
        public
        view
        returns (address[] memory)
    {
        Raffle storage raffle = getRaffleSafe(raffleId);
        uint256 seed = getSeed(raffle.endingSeedRound);
        require(seed != 0, "Raffle not finished");

        // NOTE: This is *very* naive. Ideally, we could create a tree where we
        // can maintain a O(lg N) lookup on the ticket number (where nodes store
        // the total tickets in their subtrees) and apply a pseudorandom permutation
        // function.
        // This way, the storage cost would be 2*|participants| rather than
        // |totalTickets|
        uint256 ticketsAssigned = 0;
        address[] memory tickets = new address[](raffle.totalTicketsBought);
        for (uint256 i = 0; i < raffle.participants.length; i++) {
            address participant = raffle.participants[i];

            uint256 ticketsBought = raffle.ticketsBought[participant];
            for (uint256 j = 0; j < ticketsBought; j++) {
                tickets[ticketsAssigned + j] = participant;
            }
            ticketsAssigned += ticketsBought;
        }

        return shuffledAddresses(tickets, seed);
    }

    function setBaseRaffleURI(string memory uri) external {
        _baseRaffleURI = uri;
    }

    function raffleURI(uint256 raffleId) external view returns (string memory) {
        getRaffleSafe(raffleId);

        return
            bytes(_baseRaffleURI).length > 0
                ? string(abi.encodePacked(_baseRaffleURI, raffleId.toString()))
                : "";
    }

    function pause() external onlyRole(PAUSER_ROLE) whenNotPaused {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) whenPaused {
        _unpause();
    }

    // Accessors

    function getRaffleSafe(uint256 raffleId)
        private
        view
        returns (Raffle storage)
    {
        require(raffleId < _raffles.length, "Raffle doesn't exist");
        return _raffles[raffleId];
    }

    function getRaffleCount() public view returns (uint256) {
        return _raffles.length;
    }

    function getRaffleParticipants(uint256 raffleId)
        public
        view
        returns (address[] memory)
    {
        return getRaffleSafe(raffleId).participants;
    }

    function getRaffleView(uint256 raffleId)
        public
        view
        returns (
            uint128 cost,
            uint64 endingSeedRound,
            uint32 maxEntries,
            uint32 totalTicketsBought
        )
    {
        Raffle storage raffle = getRaffleSafe(raffleId);
        return (
            raffle.cost,
            raffle.endingSeedRound,
            raffle.maxEntries,
            raffle.totalTicketsBought
        );
    }

    function getUserTicketsBought(uint256 index, address user)
        public
        view
        returns (uint256)
    {
        return getRaffleSafe(index).ticketsBought[user];
    }

    // Utility functions

    /// @notice Return generated random words for a given seed round
    function getSeed(uint256 roundNum) public view returns (uint256) {
        bytes32 reqId = _rpSeeder.getReqByBatch(roundNum);
        return _rpSeeder.getRandomness(reqId);
    }

    /// @return Randomly shuffled addresses from the given ones, using supplied seed
    /// @dev Knuth shuffle
    function shuffledAddresses(address[] memory addresses, uint256 seed)
        public
        pure
        returns (address[] memory)
    {
        address[] memory shuffled = addresses;

        uint256 pick;
        for (uint256 i = 0; i < addresses.length - 1; i++) {
            // Randomly pick a value from i (incl.) till the end of the array
            // To further increase randomness entropy, add the current player address
            // and the current iteration
            pick =
                uint256(keccak256(abi.encodePacked(i, addresses[i], seed))) %
                (addresses.length - i);

            (shuffled[i], shuffled[i + pick]) = (
                // Save the randomly picked number as the i-th address in the sequence
                shuffled[i + pick],
                // Return the original value to the pool that we pick from
                shuffled[i]
            );
        }

        return shuffled;
    }
}
