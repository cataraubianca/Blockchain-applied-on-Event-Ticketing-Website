// test/EventTicketing-test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EventTicketing contract", function () {
  let eventTicketing, owner, addr1, addr2;
  
  const ticketPrice = ethers.parseEther("0.1");
  const maxResales = 3;
  const maxTicketsPerUser = 5;
  const royaltyPercentage = 10;

  const venueName = "Test Venue";
  const venueLocation = "Test City";
  const eventDateTime = "2025-01-01 20:00:00";

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const EventTicketing = await ethers.getContractFactory("EventTicketing");
    eventTicketing = await EventTicketing.deploy(
      ticketPrice,
      maxResales,
      maxTicketsPerUser,
      royaltyPercentage,
      venueName,
      venueLocation,
      eventDateTime
    );
    await eventTicketing.waitForDeployment();
  });

  it("should set event details correctly in the constructor", async function () {
    expect(await eventTicketing.venueName()).to.equal(venueName);
    expect(await eventTicketing.venueLocation()).to.equal(venueLocation);
    expect(await eventTicketing.eventDateTime()).to.equal(eventDateTime);
  });

  it("should allow a user to purchase a ticket with seat details", async function () {
    await expect(
      eventTicketing
        .connect(addr1)
        .purchaseTicket("SeatA", "VIPZone", "7:00PM", { value: ticketPrice })
    )
      .to.emit(eventTicketing, "TicketPurchased")
      .withArgs(1, addr1.address, ticketPrice);

    const newTicketCount = await eventTicketing.ticketCount();
    expect(newTicketCount).to.equal(1n);

    const userCount = await eventTicketing.userTicketCount(addr1.address);
    expect(userCount).to.equal(1n);

    const qrCode = await eventTicketing.connect(addr1).getTicketQRCode(1);
    expect(qrCode).to.contain("QRCODE:TicketID:1");

    const ticket = await eventTicketing.tickets(1);
    expect(ticket.seatNumber).to.equal("SeatA");
    expect(ticket.zone).to.equal("VIPZone");
    expect(ticket.seatTime).to.equal("7:00PM");
  });

  it("should allow the ticket owner to list a ticket for resale", async function () {
    await eventTicketing.connect(addr1).purchaseTicket("SeatB", "RegularZone", "6:30PM", { value: ticketPrice });

    const maxAllowedResalePrice = (ticketPrice * 110n) / 100n;

    await expect(
      eventTicketing.connect(addr1).listTicketForResale(1, maxAllowedResalePrice)
    )
      .to.emit(eventTicketing, "TicketListedForResale")
      .withArgs(1, maxAllowedResalePrice);

    const ticket = await eventTicketing.tickets(1);
    expect(ticket.isForSale).to.equal(true);
    expect(ticket.price).to.equal(maxAllowedResalePrice);
    expect(ticket.owner).to.equal(addr1.address);
  });

  it("should allow another user to buy a resale ticket", async function () {
    await eventTicketing.connect(addr1).purchaseTicket("SeatC", "BalconyZone", "9:00PM", { value: ticketPrice });
    
    const resalePrice = (ticketPrice * 110n) / 100n;
    await eventTicketing.connect(addr1).listTicketForResale(1, resalePrice);

    await expect(
      eventTicketing.connect(addr2).buyResaleTicket(1, { value: resalePrice })
    )
      .to.emit(eventTicketing, "TicketResold")
      .withArgs(1, addr2.address, resalePrice);

    const ticket = await eventTicketing.tickets(1);
    expect(ticket.owner).to.equal(addr2.address);
    expect(ticket.isForSale).to.equal(false);
    expect(ticket.resaleCount).to.equal(1);

    const sellerCount = await eventTicketing.userTicketCount(addr1.address);
    const buyerCount = await eventTicketing.userTicketCount(addr2.address);
    expect(sellerCount).to.equal(0n);
    expect(buyerCount).to.equal(1n);
  });
});
