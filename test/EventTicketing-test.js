// test/EventTicketing-test.js

const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EventTicketing contract", function () {
  let eventTicketing, owner, addr1, addr2;
  
  const ticketPrice = ethers.parseEther("0.1");
  const maxResales = 3;
  const maxTicketsPerUser = 5;
  const royaltyPercentage = 10;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();

    const EventTicketing = await ethers.getContractFactory("EventTicketing");
    eventTicketing = await EventTicketing.deploy(
      ticketPrice,
      maxResales,
      maxTicketsPerUser,
      royaltyPercentage
    );
    await eventTicketing.waitForDeployment();
  });

  it("should allow a user to purchase a ticket", async function () {
    await expect(
      eventTicketing.connect(addr1).purchaseTicket({ value: ticketPrice })
    )
      .to.emit(eventTicketing, "TicketPurchased")
      .withArgs(1, addr1.address, ticketPrice);

    const newTicketCount = await eventTicketing.ticketCount();
    expect(newTicketCount).to.equal(1n);

    const userCount = await eventTicketing.userTicketCount(addr1.address);
    expect(userCount).to.equal(1n);

    const qrCode = await eventTicketing.connect(addr1).getTicketQRCode(1);
    expect(qrCode).to.contain("QRCODE:TicketID:1");
  });

  it("should allow the ticket owner to list a ticket for resale", async function () {
    await eventTicketing.connect(addr1).purchaseTicket({ value: ticketPrice });

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
    await eventTicketing.connect(addr1).purchaseTicket({ value: ticketPrice });
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
