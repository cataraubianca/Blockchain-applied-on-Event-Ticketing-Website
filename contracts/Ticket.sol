// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EventTicketing is ERC721URIStorage, Ownable {
    struct Ticket {
        address owner;
        bool isForSale;
        uint256 price;
        string qrCode;
        uint256 resaleCount;
    }

    mapping(uint256 => Ticket) public tickets;
    mapping(address => uint256) public userTicketCount;
    uint256 public ticketCount;
    uint256 public ticketPrice;
    uint256 public maxResales;
    uint256 public maxTicketsPerUser;
    uint256 public royaltyPercentage;

    event TicketPurchased(uint256 indexed ticketId, address indexed buyer, uint256 price);
    event TicketResold(uint256 indexed ticketId, address indexed buyer, uint256 price);
    event TicketListedForResale(uint256 indexed ticketId, uint256 price);

    constructor(uint256 _ticketPrice, uint256 _maxResales, uint256 _maxTicketsPerUser, uint256 _royaltyPercentage)
        ERC721("EventTicketing", "ETKT")
        Ownable(msg.sender)
    {
        ticketPrice = _ticketPrice;
        maxResales = _maxResales;
        maxTicketsPerUser = _maxTicketsPerUser;
        royaltyPercentage = _royaltyPercentage;
    }

    function generateQRCodeData(uint256 ticketId) internal pure returns (string memory) {
        return string(abi.encodePacked("QRCODE:TicketID:", Strings.toString(ticketId)));
    }

    function purchaseTicket() public payable {
        require(msg.value == ticketPrice, "Incorrect ticket price");
        require(userTicketCount[msg.sender] < maxTicketsPerUser, "Exceeded max tickets per user");

        ticketCount++;
        uint256 newItemId = ticketCount;
        _mint(msg.sender, newItemId);

        string memory qrCodeData = generateQRCodeData(newItemId);

        tickets[newItemId] = Ticket({
            owner: msg.sender,
            isForSale: false,
            price: ticketPrice,
            qrCode: qrCodeData,
            resaleCount: 0
        });

        userTicketCount[msg.sender]++;
        emit TicketPurchased(newItemId, msg.sender, ticketPrice);
    }

    function listTicketForResale(uint256 ticketId, uint256 price) public {
        require(tickets[ticketId].owner == msg.sender, "Not the ticket owner");
        require(price > 0, "Price must be greater than zero");
        require(price <= (tickets[ticketId].price * 110) / 100, "Resale price exceeds 110% of buying price");
        require(tickets[ticketId].resaleCount < maxResales, "Exceeded max resales");

        tickets[ticketId].isForSale = true;
        tickets[ticketId].price = price;
        emit TicketListedForResale(ticketId, price);
    }

    function buyResaleTicket(uint256 ticketId) public payable {
        require(tickets[ticketId].isForSale, "Ticket not for sale");
        require(msg.value == tickets[ticketId].price, "Incorrect ticket price");
        require(userTicketCount[msg.sender] < maxTicketsPerUser, "Exceeded max tickets per user");

        address seller = tickets[ticketId].owner;
        uint256 royaltyAmount = (msg.value * royaltyPercentage) / 100;
        uint256 sellerAmount = msg.value - royaltyAmount;

        payable(seller).transfer(sellerAmount);
        payable(owner()).transfer(royaltyAmount);

        tickets[ticketId].owner = msg.sender;
        tickets[ticketId].isForSale = false;
        tickets[ticketId].resaleCount++;
        userTicketCount[seller]--;
        userTicketCount[msg.sender]++;

        _transfer(seller, msg.sender, ticketId);
        emit TicketResold(ticketId, msg.sender, tickets[ticketId].price);
    }

    function withdrawFunds() public onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function getTicketQRCode(uint256 ticketId) public view returns (string memory) {
        require(tickets[ticketId].owner == msg.sender, "Not the ticket owner");
        return tickets[ticketId].qrCode;
    }
    receive() external payable {}
}
