// Import Hardhat Runtime Environment
const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const EventTicketing = await hre.ethers.getContractFactory("EventTicketing");
    console.log("Deploying EventTicketing contract...");

    const ticketPrice = hre.ethers.parseEther("0.1");
    const maxResales = 3;
    const maxTicketsPerUser = 5;
    const royaltyPercentage = 10;

    const eventTicketing = await EventTicketing.deploy(ticketPrice, maxResales, maxTicketsPerUser, royaltyPercentage);

    await eventTicketing.waitForDeployment();

    console.log("EventTicketing contract deployed to:", eventTicketing.target);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
