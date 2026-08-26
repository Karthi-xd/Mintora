// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts@5.0.0/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts@5.0.0/access/Ownable.sol";
import "@openzeppelin/contracts@5.0.0/utils/Pausable.sol";

contract MyNFT is ERC721URIStorage, Ownable, Pausable {
    uint256 private _nextTokenId;

    uint256 public constant MAX_SUPPLY = 1000;
    uint256 public constant MAX_URI_LENGTH = 200; // keeps gas/storage bounded; ipfs:// CIDs are ~60-70 chars
    uint256 public mintPrice = 0.001 ether;

    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);
    event Minted(address indexed to, uint256 indexed tokenId, string uri);

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

    function mint(address to, string memory uri) public payable whenNotPaused returns (uint256) {
        require(_nextTokenId < MAX_SUPPLY, "Sold out");
        require(msg.value >= mintPrice, "Insufficient payment");
        require(bytes(uri).length > 0 && bytes(uri).length <= MAX_URI_LENGTH, "Invalid URI length");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        uint256 refund = msg.value - mintPrice;
        if (refund > 0) {
            (bool sent, ) = payable(msg.sender).call{value: refund}("");
            require(sent, "Refund failed");
        }

        emit Minted(to, tokenId, uri);
        return tokenId;
    }

    function totalMinted() public view returns (uint256) {
        return _nextTokenId;
    }

    function setMintPrice(uint256 newPrice) public onlyOwner {
        emit MintPriceUpdated(mintPrice, newPrice);
        mintPrice = newPrice;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function withdraw() public onlyOwner {
        (bool success, ) = payable(owner()).call{value: address(this).balance}("");
        require(success, "Withdraw failed");
    }
}