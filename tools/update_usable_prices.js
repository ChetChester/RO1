/* 用 rAthena 價格更新消耗品/材料的 sell/buyPrice */
const fs = require('fs');
const path = require('path');

// rAthena usable item 價格 (從 item_db_usable.yml 提取)
const rathenaPrices = {
  501: 50, 502: 200, 503: 550, 504: 1200, 505: 5000, 506: 40,
  507: 18, 508: 40, 509: 120, 510: 60, 511: 10, 512: 15, 513: 15,
  514: 200, 515: 15, 516: 15, 517: 50, 518: 500, 519: 25,
  520: 150, 521: 360, 522: 8500, 523: 20, 525: 500, 526: 7000,
  528: 60, 529: 10, 530: 20, 531: 20, 532: 20, 533: 250,
  534: 20, 535: 15, 536: 150, 537: 1000, 538: 1000, 539: 3000,
  540: 2000, 541: 3000, 544: 20, 545: 150, 546: 600, 547: 1650,
  548: 2800, 549: 180, 550: 10, 551: 1, 552: 1, 553: 1,
  554: 400, 555: 100, 556: 10, 557: 10, 558: 1, 559: 1,
  561: 5000, 562: 100, 563: 1200, 564: 1, 565: 580, 566: 10000,
  567: 500, 568: 60, 569: 0, 570: 10, 571: 20, 572: 1000,
  573: 7000, 574: 20, 576: 540, 577: 200, 578: 200, 579: 250,
  580: 150, 581: 40, 582: 300, 585: 2, 586: 20, 587: 880,
  588: 100, 589: 1200, 590: 2, 598: 50, 599: 200,
  601: 60, 602: 300, 603: 10000, 604: 50, 605: 2000, 606: 1500,
  607: 5000, 608: 5000, 609: 100, 610: 4000, 611: 40,
  612: 150, 613: 1000, 614: 3000, 615: 5000, 616: 10000, 617: 10000,
  618: 50, 619: 1000, 620: 1500, 621: 20, 622: 2500, 623: 4000,
  624: 2500, 625: 100, 626: 1500, 627: 7000, 628: 10000, 629: 300,
  630: 10, 631: 20, 632: 5000, 633: 20, 634: 20, 635: 300,
  636: 100, 637: 350, 638: 12000, 639: 18000, 640: 3000,
  641: 100, 642: 1800, 643: 3000, 644: 1000, 645: 800,
  656: 1500, 657: 3000, 659: 500, 662: 1450, 663: 1,
  664: 1000, 665: 1000, 666: 1000, 667: 1000, 669: 500,
  686: 1000, 687: 2000, 688: 1000, 689: 2000, 690: 1000,
  691: 2000, 692: 1000, 693: 2000, 694: 1000, 695: 2000,
  696: 1000, 697: 2000, 698: 1000, 699: 2000, 700: 1000,
};

const dataPath = path.join(__dirname, '..', 'js', 'data.js');
let data = fs.readFileSync(dataPath, 'utf8');

let updateCount = 0;

for (const [imgIdStr, buyPrice] of Object.entries(rathenaPrices)) {
  const imgId = parseInt(imgIdStr);
  const sellPrice = Math.floor(buyPrice / 2);
  
  // 找到對應的物品
  const regex = new RegExp(`"imgId":${imgId}`);
  if (!data.match(regex)) continue;
  
  // 更新 buyPrice
  const buyRegex = new RegExp(`("imgId":${imgId}[^}]*?"buyPrice":)(\\d+)`);
  if (data.match(buyRegex)) {
    data = data.replace(buyRegex, `$1${buyPrice}`);
  } else {
    const addRegex = new RegExp(`("imgId":${imgId}[^}]*?)}`);
    data = data.replace(addRegex, `$1,"buyPrice":${buyPrice}}`);
  }
  
  // 更新 sellPrice
  const sellRegex = new RegExp(`("imgId":${imgId}[^}]*?"sell":)(\\d+)`);
  if (data.match(sellRegex)) {
    data = data.replace(sellRegex, `$1${sellPrice}`);
  }
  
  updateCount++;
}

fs.writeFileSync(dataPath, data, 'utf8');
console.log(`已更新 ${updateCount} 個物品的價格`);
