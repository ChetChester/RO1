/* ---------------- 技能定義 ----------------
   全遊戲的技能本體，一個 id 一份，由 tools/extract_skills_registry.js 從 js/jobs.js 搬出來。
   職業（js/jobs.js）只列「有哪些技能」的 id，載入時再換回物件。

   這樣拆的理由：官方超級新手可以使用全部六個一轉職業的技能，巢狀結構下只能整份複製；
   轉生職與進階二轉同一個技能上限不同時，也只要在職業那邊寫 { id, maxLv } 覆寫即可。

   本檔必須在 js/jobs.js 之前載入。
------------------------------------------------- */

const SKILLS = {
  novice_firstaid: {"id":"novice_firstaid","name":"急救術 First Aid","maxLv":5,"type":"heal","element":"neutral","spCost":[5,5,5,5,5],"cooldown":[5,5,5,5,5],"mult":[0.5,0.8,1.1,1.4,1.7],"desc":"消耗少量SP恢復HP。"},
  novice_basicskill: {"id":"novice_basicskill","name":"基礎訓練 Basic Training","maxLv":5,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[2,4,6,8,10],"desc":"永久提升攻擊力。"},
  novice_hpboost: {"id":"novice_hpboost","name":"體能強化 HP Boost","maxLv":5,"type":"passive","passiveStat":"maxHpMult","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1.05,1.1,1.15,1.2,1.25],"desc":"永久提升最大HP。"},
  novice_flee: {"id":"novice_flee","name":"閃避提升 Flee Boost","maxLv":5,"type":"passive","passiveStat":"fleeFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15],"desc":"永久提升迴避率。"},
  berserk_sword: {"id":"berserk_sword","name":"狂暴狀態 Berserk","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"berserk","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1],"desc":"HP低於25%時自動發動，ATK +32%、DEF -55%。"},
  fatalblow: {"id":"fatalblow","name":"攻擊弱點 Fatal Blow","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"bashStunProc","element":"neutral","spCost":[0],"cooldown":[0],"procChance":[50],"stunSec":[1],"mult":[1],"desc":"被動技能，狂擊命中時有50%機率使敵人暈眩1秒。"},
  hpmove: {"id":"hpmove","name":"移動時恢復HP","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"hpMoveRegen","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1],"desc":"每10秒自動回復HP（戰鬥中也有效）。"},
  bash: {"id":"bash","name":"狂擊 Bash","maxLv":10,"type":"damage","element":"neutral","spCost":[8,8,8,8,8,15,15,15,15,15],"cooldown":[3,3,3,3,3,3,3,3,3,3],"mult":[1.3,1.6,1.9,2.2,2.5,2.8,3.1,3.4,3.7,4],"hitBonus":[5,10,15,20,25,30,35,40,45,50],"desc":"強力一擊，造成ATK×130%~400%傷害，命中+5~50。"},
  magnumbreak: {"id":"magnumbreak","name":"怒爆 Magnum Break","maxLv":10,"type":"damage_aoe","element":"fire","spCost":[30,30,30,30,30,30,30,30,30,30],"cooldown":[2,2,2,2,2,2,2,2,2,2],"mult":[1.2,1.4,1.6,1.8,2,2.2,2.4,2.6,2.8,3],"buffPct":20,"buffDurationSec":10,"desc":"以火焰之力對全部敵人造成火屬性ATK×120%~300%傷害，並使自身10秒內普攻額外附加20%火屬性傷害。"},
  provoke: {"id":"provoke","name":"挑釁 Provoke","maxLv":10,"type":"debuff_def","element":"neutral","spCost":[3,3,4,4,5,5,6,6,7,8],"cooldown":[10,10,10,10,10,10,10,10,10,10],"mult":[0.9,0.85,0.8,0.75,0.7,0.65,0.6,0.55,0.5,0.45],"duration":[10,10,10,10,10,10,10,10,10,10],"desc":"激怒敵人，使其DEF降低10%~55%，必定成功。"},
  endure: {"id":"endure","name":"霸體 Endure","maxLv":10,"type":"buff_def","element":"neutral","spCost":[10,10,10,10,10,10,10,10,10,10],"cooldown":[20,20,20,20,20,20,20,20,20,20],"mult":[1.1,1.15,1.2,1.25,1.3,1.35,1.4,1.45,1.5,1.55],"duration":[10,12,14,16,18,20,22,24,26,28],"desc":"短時間內DEF與MDEF大幅提升10%~55%。"},
  increasehp: {"id":"increasehp","name":"快速恢復 Increase HP Recovery","maxLv":10,"type":"passive","passiveStat":"hpRegenMult","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8,1.9,2],"itemEffectBonus":[10,20,30,40,50,60,70,80,90,100],"desc":"HP自然恢復+10%~100%，並使HP恢復道具效果+10%~100%。"},
  swordmastery: {"id":"swordmastery","name":"單手劍熟練度 Sword Mastery","maxLv":10,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[4,8,12,16,20,24,28,32,36,40],"requiresWeapon":"sword","desc":"劍與短劍 ATK +4~40（需裝備單手劍或短劍才生效）。"},
  twoswordmastery: {"id":"twoswordmastery","name":"雙手劍熟練度 Two-Handed Sword Mastery","maxLv":10,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[4,8,12,16,20,24,28,32,36,40],"requiresWeapon":"sword2","desc":"雙手劍 ATK +4~40（需裝備雙手劍才生效）。"},
  sight: {"id":"sight","name":"火狩","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"fleeFlat","spCost":[0],"cooldown":[0],"mult":[10],"desc":"被動技能，永久提升迴避+10。"},
  energycoat: {"id":"energycoat","name":"能量外套","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"energyCoatUnlock","spCost":[0],"cooldown":[0],"mult":[1],"dmgReductionPct":[30],"spCostPct":[3],"desc":"被動技能，解鎖後可在自動戰鬥頁面勾選啟動：啟動時減傷30%，但每次受到攻擊消耗3%最大SP；可設定SP%下限，低於門檻時暫停生效。"},
  firebolt: {"id":"firebolt","name":"火箭術","maxLv":10,"type":"magic","element":"fire","spCost":[12,14,16,18,20,22,24,26,28,30],"cooldown":[10,10,10,10,10,10,10,10,10,10],"mult":[1,2,3,4,5,6,7,8,9,10],"desc":"發射火箭，造成火屬性魔法傷害MATK100%~1000%（依等級）。"},
  fireball: {"id":"fireball","name":"火球術","maxLv":10,"type":"magic_aoe","element":"fire","spCost":[25,25,25,25,25,25,25,25,25,25],"cooldown":[2,2,2,2,2,2,2,2,2,2],"mult":[1.6,1.8,2,2.2,2.4,2.6,2.8,3,3.2,3.4],"desc":"投擲火球，對範圍造成火屬性魔法傷害MATK160%~340%（依等級）。"},
  firewall: {"id":"firewall","name":"火焰之壁","maxLv":1,"type":"multi_dot_stun","element":"fire","spCost":[40],"cooldown":[10],"maxTargets":[3],"stunSec":[1],"mult":[0.5],"tickIntervalSec":[1],"dotDurationSec":[3],"desc":"對場上最多3名敵人各暈眩1秒，並造成每秒MATK50%持續火屬性魔法傷害，持續3秒。"},
  lightningbolt: {"id":"lightningbolt","name":"雷擊術","maxLv":10,"type":"magic","element":"wind","spCost":[12,14,16,18,20,22,24,26,28,30],"cooldown":[10,10,10,10,10,10,10,10,10,10],"mult":[1,2,3,4,5,6,7,8,9,10],"desc":"召喚雷電，造成風屬性魔法傷害MATK100%~1000%（依等級）。"},
  thunderstorm: {"id":"thunderstorm","name":"雷爆術","maxLv":10,"type":"magic_aoe","element":"wind","spCost":[29,34,39,44,49,54,59,64,69,74],"cooldown":[10,10,10,10,10,10,10,10,10,10],"mult":[1,2,3,4,5,6,7,8,9,10],"desc":"從天空降下雷電，對範圍造成風屬性魔法傷害MATK100%~1000%（依等級）。"},
  coldbolt: {"id":"coldbolt","name":"冰箭術","maxLv":10,"type":"magic","element":"water","spCost":[12,14,16,18,20,22,24,26,28,30],"cooldown":[10,10,10,10,10,10,10,10,10,10],"mult":[1,2,3,4,5,6,7,8,9,10],"desc":"發射冰箭，造成水屬性魔法傷害MATK100%~1000%（依等級）。"},
  frostdiver: {"id":"frostdiver","name":"冰凍術","maxLv":1,"type":"passive","passiveStat":"onHitMagicStunProc","element":"water","spCost":[0],"cooldown":[0],"procChance":[65],"stunSec":[10],"mult":[0.5],"internalCooldown":[10],"desc":"被動技能，被攻擊時有65%機率使攻擊者暈眩10秒，並造成MATK50%魔法傷害。之後若我方對其造成魔法傷害會提前喚醒。冷卻10秒。"},
  stonecurse: {"id":"stonecurse","name":"石化術","maxLv":1,"type":"passive","passiveStat":"onHitMagicStunProc","element":"earth","spCost":[0],"cooldown":[0],"procChance":[30],"stunSec":[10],"mult":[0.5],"internalCooldown":[10],"desc":"被動技能，被攻擊時有30%機率使攻擊者暈眩10秒，並造成MATK50%魔法傷害。之後若我方對其造成魔法傷害會提前喚醒。冷卻10秒。"},
  napalmbeat: {"id":"napalmbeat","name":"心靈爆破","maxLv":10,"type":"magic_aoe","element":"shadow","spCost":[9,9,9,12,12,12,15,15,15,18],"cooldown":[1,1,1,1,1,1,1,1,1,1],"mult":[0.8,0.9,1,1.1,1.2,1.3,1.4,1.5,1.6,1.7],"desc":"對目標和周圍造成念屬性魔法傷害MATK80%~170%（依等級）。"},
  soulstrike: {"id":"soulstrike","name":"聖靈召喚","maxLv":10,"type":"magic","element":"neutral","spCost":[18,14,24,20,30,26,36,32,42,38],"cooldown":[10,9.4,8.9,8.3,7.8,7.2,6.7,6.1,5.6,5],"mult":[1,1.44,1.89,2.33,2.78,3.22,3.67,4.11,4.56,5],"undeadBonusPct":[5,10,15,20,25,30,35,40,45,50],"desc":"召喚聖靈攻擊，造成念屬性魔法傷害MATK100%~500%（依等級），對不死種族額外+5%~50%傷害。"},
  safetywall: {"id":"safetywall","name":"暗之障壁","maxLv":10,"type":"buff_shield","spCost":[30,30,30,35,35,35,40,40,40,40],"cooldown":[10,10,10,10,10,10,10,10,10,10],"shieldCapacityFlat":[300,600,900,1200,1500,1800,2100,2400,2700,3000],"shieldCharges":[2,3,4,5,6,7,8,9,10,11],"duration":[5,10,15,20,25,30,35,40,45,50],"desc":"設置魔法障壁，耐久度300~3000（依等級），可抵擋2~11次近距離物理傷害，持續5~50秒。"},
  spregen: {"id":"spregen","name":"禪心","maxLv":10,"type":"passive","passiveStat":"zenRecovery","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"spPctBonus":[0.2,0.4,0.6,0.8,1,1.2,1.4,1.6,1.8,2],"itemEffectBonus":[10,20,30,40,50,60,70,80,90,100],"desc":"被動技能，永久提升SP自然恢復量+3~30與+0.2%~2%，並使SP恢復道具效果+10%~100%（依等級）。"},
  createarrow: {"id":"createarrow","name":"製作箭","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"arrowCraft","spCost":[0],"cooldown":[0],"mult":[1],"desc":"學會製作箭矢。"},
  chargearrow: {"id":"chargearrow","name":"衝鋒箭","maxLv":1,"isQuest":true,"type":"damage","spCost":[15],"cooldown":[5],"mult":[1.5],"desc":"蓄力射出強力一箭，命中時使敵人暈眩1~3秒（代表擊退），無法攻擊。"},
  owleye: {"id":"owleye","name":"鶚梟之眼","maxLv":10,"type":"passive","passiveStat":"dexFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1,2,3,4,5,6,7,8,9,10],"desc":"永久提升DEX。"},
  vultureeye: {"id":"vultureeye","name":"蒼鷹之眼","maxLv":10,"type":"passive","passiveStat":"hitFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1,2,3,4,5,6,7,8,9,10],"aspdFlat":[1,1,1,1,2,2,2,2,2,3],"desc":"永久提升命中+1~10；並提升攻速（Lv1~4:+1、Lv5~9:+2、Lv10:+3，代表攻擊距離的簡化效果）。"},
  improveconc: {"id":"improveconc","name":"心神凝聚","maxLv":10,"type":"buff_statpct","spCost":[8,8,8,8,8,8,8,8,8,8],"cooldown":[18,18,18,18,18,18,18,18,18,18],"mult":[0.03,0.04,0.05,0.06,0.07,0.08,0.09,0.1,0.11,0.12],"duration":[60,80,100,120,140,160,180,200,220,240],"desc":"短暫提升DEX與AGI 3%~12%（依等級），持續60秒~240秒。"},
  doublestrafe: {"id":"doublestrafe","name":"二連矢","maxLv":10,"type":"damage","element":"neutral","spCost":[10,10,10,10,10,12,12,12,12,12],"cooldown":[3,3,3,3,3,3,3,3,3,3],"mult":[1,1.3,1.6,1.9,2.2,2.5,2.8,3.1,3.4,3.7],"desc":"連射兩箭，造成物理傷害。"},
  arrowshower: {"id":"arrowshower","name":"箭雨","maxLv":10,"type":"damage_aoe","element":"neutral","spCost":[15,15,15,15,15,18,18,18,18,18],"cooldown":[4,4,4,4,4,4,4,4,4,4],"mult":[1,1.2,1.4,1.6,1.8,2,2.2,2.4,2.6,2.8],"desc":"向天空射出箭雨，造成範圍物理傷害。"},
  vending: {"id":"vending","name":"露天商店","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"vending","spCost":[0],"cooldown":[0],"internalCooldown":60,"sellMultiplier":10,"desc":"被動技能，可在背包頁面選最多3樣道具，每60秒自動以10倍價格賣出各1個。"},
  itemappraisal: {"id":"itemappraisal","name":"物品鑑定","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"triStatBonus","spCost":[0],"cooldown":[0],"mult":[5],"desc":"被動技能，永久提升STR+5、INT+5、DEX+5。"},
  loudexclamation: {"id":"loudexclamation","name":"大聲吶喊","maxLv":1,"isQuest":true,"type":"buff_flatstat","spCost":[0],"cooldown":[30],"strBonus":[4],"mult":[30],"duration":[300],"desc":"短暫提升STR+4、ATK+30，持續300秒（隊伍效果暫不支援，待未來擴充）。"},
  cartattack: {"id":"cartattack","name":"手推車攻擊","maxLv":1,"isQuest":true,"type":"damage_aoe","element":"neutral","spCost":[8],"cooldown":[3],"mult":[1.5],"desc":"轉職自動習得，用手推車撞擊敵人與周圍怪物，固定造成ATK150%範圍傷害。"},
  discount: {"id":"discount","name":"低價買進","maxLv":10,"type":"passive","passiveStat":"discount","element":"neutral","spCost":[0],"cooldown":[0],"mult":[0.93,0.91,0.89,0.87,0.85,0.83,0.81,0.79,0.77,0.76],"desc":"永久降低商店購買價格7%~24%（依等級）。"},
  overcharge: {"id":"overcharge","name":"高價賣出","maxLv":10,"type":"passive","passiveStat":"overcharge","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1.07,1.09,1.11,1.13,1.15,1.17,1.19,1.21,1.23,1.24],"desc":"永久提升販售價格7%~24%（依等級）。"},
  pushcart: {"id":"pushcart","name":"手推車使用","maxLv":10,"type":"passive","passiveStat":"autoCartItem","element":"neutral","spCost":[0],"cooldown":[0],"intervalSec":[30,25,25,20,20,15,15,15,15,15],"itemPools":[["carrot"],["carrot"],["carrot","apple","banana","grape","melon","coconut"],["carrot","apple","banana","grape","melon","coconut"],["carrot","apple","banana","grape","melon","coconut","red_potion","blue_herb"],["carrot","apple","banana","grape","melon","coconut","red_potion","blue_herb"],["carrot","apple","banana","grape","melon","coconut","red_potion","blue_herb","orange_potion"],["carrot","apple","banana","grape","melon","coconut","red_potion","blue_herb","orange_potion","yellow_potion","blue_potion"],["carrot","apple","banana","grape","melon","coconut","red_potion","blue_herb","orange_potion","yellow_potion","blue_potion","white_potion"],["carrot","apple","banana","grape","melon","coconut","red_potion","blue_herb","orange_potion","yellow_potion","blue_potion","white_potion","honey"]],"desc":"被動技能，隨等級解鎖更多隨機獲得的道具池並縮短冷卻：Lv1紅蘿蔔(CD30s)、Lv2(CD25s)、Lv3解鎖水果(CD25s)、Lv4(CD20s)、Lv5解鎖紅色藥水與藍色藥草(CD20s)、Lv6(CD15s)、Lv7解鎖赤色藥水(CD15s)、Lv8解鎖黃色藥水與藍色藥水、Lv9解鎖白色藥水、Lv10解鎖蜂蜜。每次觸發從當前等級的道具池隨機取得1個。"},
  mammonite: {"id":"mammonite","name":"金錢攻擊","maxLv":10,"type":"damage","element":"neutral","spCost":[5,5,6,6,7,7,8,8,9,9],"cooldown":[2,2,2,2,2,2,2,2,2,2],"mult":[1.5,2,2.5,3,3.5,4,4.5,5,5.5,6],"zenyCost":[100,200,300,400,500,600,700,800,900,1000],"desc":"消耗100~1000鋅幣（依等級），造成ATK150%~600%傷害。"},
  weightup: {"id":"weightup","name":"負重量上升","maxLv":10,"type":"passive","passiveStat":"cartDmgBonus","element":"neutral","spCost":[0],"cooldown":[0],"mult":[0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9,1],"desc":"永久提升金錢攻擊與手推車攻擊傷害，滿級+100%。"},
  detoxify: {"id":"detoxify","name":"解毒","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"autoDetox","spCost":[0],"cooldown":[0],"mult":[1],"internalCooldown":[30],"desc":"被動技能，玩家中毒時自動解除（冷卻30秒）。"},
  sandman: {"id":"sandman","name":"噴砂","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"sandmanProc","spCost":[0],"cooldown":[0],"mult":[1],"procChance":[10],"hitDebuff":[20],"duration":[5],"desc":"被動技能，攻擊時有10%機率使敵人命中下降20，持續5秒。"},
  backsliding: {"id":"backsliding","name":"後退迴避","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"backslideDodge","spCost":[0],"cooldown":[0],"mult":[1],"dodgeChance":[5],"desc":"被動技能，被攻擊時有5%機率向後閃避，完全免疫該次傷害。"},
  steal: {"id":"steal","name":"偷竊","maxLv":10,"type":"passive","passiveStat":"steal","spCost":[0],"cooldown":[0],"mult":[8,14,20,26,32,38,44,50,56,62],"desc":"被動技能，擊敗怪物時有 8%~62% 機率額外掉落一份該怪物的道具。"},
  doubleattack: {"id":"doubleattack","name":"二刀連擊","maxLv":10,"type":"passive","passiveStat":"doubleAttack","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1,1,1,1,1,1,1,1,1,1],"doubleAttackChance":[7,14,21,28,35,42,49,56,63,70],"hitBonus":[1,2,3,4,5,6,7,8,9,10],"desc":"被動技能，裝備短劍時普攻有 7%~70% 機率造成二連擊（傷害與第一段相同），並永久提升命中 +1~10。拿其他武器不會觸發（黑蛇卡片給的那份不受此限）。"},
  improvedodge: {"id":"improvedodge","name":"殘影","maxLv":10,"type":"passive","passiveStat":"fleeFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"assassinMult":[4,8,12,16,20,24,28,32,36,40],"desc":"永久提升迴避率 FLEE+3~30（轉職刺客系後提升為+4~40）。"},
  hiding: {"id":"hiding","name":"隱匿","maxLv":10,"type":"buff_flee","spCost":[10,10,10,10,10,10,10,10,10,10],"cooldown":[30,30,30,30,30,30,30,30,30,30],"mult":[1.3,1.35,1.4,1.45,1.5,1.55,1.6,1.65,1.7,1.75],"duration":[10,10,10,10,10,10,10,10,10,10],"desc":"短暫隱匿身形，大幅提升迴避。"},
  envenom: {"id":"envenom","name":"施毒","maxLv":10,"type":"poison_proc","element":"poison","spCost":[12,12,12,12,12,12,12,12,12,12],"cooldown":[10,10,10,10,10,10,10,10,10,10],"mult":1.2,"procChance":[5,10,15,20,25,30,35,40,45,50],"desc":"主動技能，命中造成固定ATK120%傷害（不隨等級變化），另外有5%~50%（依等級）機率使敵人中毒，持續3秒，每秒造成ATK120%的中毒傷害（不會疊加）。毒屬性怪物免疫。"},
  teleport: {"id":"teleport","name":"瞬間移動","maxLv":2,"isQuest":true,"type":"passive","passiveStat":"fleeFlat","spCost":[0],"cooldown":[0],"mult":[5,10],"desc":"被動技能，永久提升迴避+5~+10（依等級）。"},
  warpportal: {"id":"warpportal","name":"傳送之陣","maxLv":4,"isQuest":true,"type":"stun_field","aoeFromLv":3,"stunSec":1,"spCost":[15,18,21,24],"cooldown":[20,15,15,10],"desc":"Lv1-2對當前目標暈眩1秒，Lv3-4對場上全體怪物暈眩1秒。冷卻時間隨等級縮短（20~10秒）。"},
  ruwach: {"id":"ruwach","name":"光獵","maxLv":1,"isQuest":true,"type":"magic_aoe","element":"holy","spCost":[10],"cooldown":[20],"mult":[1.45],"bonusHitBuff":[10],"bonusHitDuration":[20],"desc":"召喚聖靈，使自身HIT+10（持續20秒），並對場上所有敵人造成145%聖屬性魔法傷害。"},
  pneuma: {"id":"pneuma","name":"光之障壁","maxLv":1,"isQuest":true,"type":"buff_def","spCost":[10],"cooldown":[20],"mult":[1.5],"duration":[10],"desc":"創造一道光之障壁，短暫提升防禦力，持續10秒。"},
  divineprotection: {"id":"divineprotection","name":"天使之護","maxLv":10,"isQuest":true,"type":"passive","passiveStat":"defFlat","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"desc":"被惡魔/不死種族攻擊時，物理防禦力+3~30（依等級）。"},
  heal: {"id":"heal","name":"治癒術","maxLv":10,"type":"heal","spCost":[12,14,16,18,20,22,24,26,28,30],"cooldown":[4,4,4,4,4,4,4,4,4,4],"mult":[1,1.3,1.6,1.9,2.2,2.5,2.8,3.1,3.4,3.7],"desc":"恢復自身HP。可在自動戰鬥頁面設定依HP%/SP%門檻自動施放。"},
  blessing: {"id":"blessing","name":"加速術","maxLv":10,"type":"buff_aspd","spCost":[18,21,24,27,30,33,36,39,42,45],"hpCost":[15,15,15,15,15,15,15,15,15,15],"cooldown":[25,25,25,25,25,25,25,25,25,25],"mult":[1.01,1.02,1.03,1.04,1.05,1.06,1.07,1.08,1.09,1.1],"agiFlatBonus":[3,4,5,6,7,8,9,10,11,12],"duration":[60,80,100,120,140,160,180,200,220,240],"desc":"消耗15HP，使自身AGI+3~12、攻速+1%~10%，持續60~240秒（依等級）。（移動速度加成與解除緩速效果暫為敘述用，遊戲無對應機制）"},
  decreaseagi: {"id":"decreaseagi","name":"緩速術","maxLv":10,"type":"passive","passiveStat":"onHitStunProc","spCost":[0],"cooldown":[0],"procChance":[53,56,59,62,65,68,71,74,77,80],"stunSec":0.5,"internalCooldown":[10,9.4,8.9,8.3,7.8,7.2,6.7,6.1,5.6,5],"desc":"被動技能，被攻擊時有53%~80%機率使攻擊者暈眩0.5秒（依等級），冷卻10~5秒。"},
  angelic: {"id":"angelic","name":"天使之擊","maxLv":10,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"desc":"對惡魔/不死種族攻擊時，固定傷害+3~30（依等級），不受DEF削減。"},
  aquabenedicta: {"id":"aquabenedicta","name":"天使之賜福","maxLv":10,"type":"buff_blessing","spCost":[28,32,36,40,44,48,52,56,60,64],"cooldown":[30,30,30,30,30,30,30,30,30,30],"statBonus":[1,2,3,4,5,6,7,8,9,10],"hitBonus":[2,4,6,8,10,12,14,16,18,20],"duration":[60,80,100,120,140,160,180,200,220,240],"desc":"使自身STR/INT/DEX各+1~10、HIT+2~20，持續60~240秒（依等級）。異常狀態解除（詛咒/石化）暫擱置。"},
  signumcrusis: {"id":"signumcrusis","name":"天使之光","maxLv":10,"type":"debuff_def","spCost":[10,10,10,10,10,10,10,10,10,10],"cooldown":[20,19,18,17,16,14,13,12,11,10],"mult":[1.02,1.04,1.06,1.08,1.1,1.12,1.14,1.16,1.18,1.2],"duration":[10,10,10,10,10,10,10,10,10,10],"desc":"降低敵人防禦力，持續10秒，冷卻隨等級縮短（20~10秒）。"},
  cure: {"id":"cure","name":"天使之淚","maxLv":1,"type":"passive","passiveStat":"autoDetox","spCost":[0],"cooldown":[0],"mult":[1],"internalCooldown":[10],"desc":"被動技能，身上有異常狀態時自動解除，冷卻10秒。（遊戲目前玩家唯一會有的異常狀態是中毒）"},
  holylight: {"id":"holylight","name":"神聖之光","maxLv":1,"type":"magic","element":"holy","spCost":[20],"cooldown":[3],"mult":[1.5],"desc":"發射聖光，對不死系敵人造成額外傷害。"},
  riding: {"id":"riding","name":"騎乘術 Peco Peco Ride","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"riding","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1],"desc":"騎乘波利波利鳥，生怪速度+25%。"},
  charge: {"id":"charge","name":"衝鋒攻擊 Charge Attack","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"chargeRandomProc","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1.5],"internalCooldown":[5],"desc":"被動技能，場上敵人數≥2時，每5秒隨機對一隻造成ATK150%傷害。"},
  cavaliermastery: {"id":"cavaliermastery","name":"騎兵修練 Cavalier Mastery","maxLv":1,"type":"passive","passiveStat":"cavalierBonus","element":"neutral","spCost":[0],"cooldown":[0],"mult":[5],"atkBonus":[10],"critBonus":[3],"desc":"被動技能，永久提升ATK+10、迴避+5、暴擊率+3%。"},
  bowlingbash: {"id":"bowlingbash","name":"怪物互擊 Bowling Bash","maxLv":10,"type":"damage_multihit","element":"neutral","spCost":[13,14,15,16,17,18,20,22,24,28],"cooldown":[5,5,5,5,5,5,5,5,5,5],"mult":[2,2.3,2.6,2.9,3.2,3.5,3.8,4.1,4.5,5],"mult2":[2,2,2,2,2,2,2,2,2,2],"desc":"強力一擊造成2段傷害：第一段ATK×200%~500%，第二段範圍ATK×200%。"},
  pierce: {"id":"pierce","name":"連刺攻擊 Pierce","maxLv":10,"type":"damage","element":"neutral","spCost":[10,10,10,12,12,12,15,15,15,20],"cooldown":[2,2,2,2,2,2,2,2,2,2],"mult":[2,2.44,2.89,3.33,3.78,4.22,4.67,5.11,5.56,6],"requiresWeapon":"spear","desc":"長矛專用技能，造成ATK×200%~600%傷害（需裝備矛類武器，體型加成待日後補上）。"},
  twohandquicken: {"id":"twohandquicken","name":"雙手劍加速 Twohand Quicken","maxLv":10,"type":"buff_aspd","element":"neutral","spCost":[14,18,22,26,30,34,38,42,46,50],"cooldown":[30,30,30,30,30,30,30,30,30,30],"mult":[1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3,1.3],"duration":[30,60,90,120,150,180,210,240,270,300],"bonusCrit":[3,4,5,6,7,8,9,10,11,12],"bonusHit":[2,4,6,8,10,12,14,16,18,20],"requiresWeapon":"sword2","desc":"雙手劍專用技能，30秒~300秒內ASPD+30%、暴擊率+3~12、命中+2~20（需裝備雙手劍才能施放）。"},
  spearmastery: {"id":"spearmastery","name":"長矛熟練度 Spear Mastery","maxLv":10,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[5,10,15,20,25,30,35,40,45,50],"requiresWeapon":"spear","desc":"長矛ATK+5~50（需裝備矛類武器才生效）。"},
  spearstab: {"id":"spearstab","name":"長矛刺擊 Spear Stab","maxLv":1,"type":"passive","passiveStat":"spearCounterProc","element":"neutral","spCost":[0],"cooldown":[0],"procChance":[30],"mult":[2],"stunSec":[2],"internalCooldown":[10],"desc":"被動技能，需裝備矛類武器。被攻擊時有30%機率反擊，造成ATK200%傷害並使攻擊者暈眩2秒，冷卻10秒。"},
  spearboomerang: {"id":"spearboomerang","name":"投擲長矛 Spear Boomerang","maxLv":1,"type":"passive","passiveStat":"spearBoomerangProc","element":"neutral","spCost":[0],"cooldown":[0],"mult":[2],"internalCooldown":[5],"desc":"被動技能，需裝備矛類武器。場上敵人數≥2時，每5秒隨機對一隻造成ATK200%傷害。"},
  brandishspear: {"id":"brandishspear","name":"騎乘攻擊 Brandish Spear","maxLv":1,"type":"damage_aoe","element":"neutral","spCost":[24],"cooldown":[3],"mult":[5],"strScaleMax":[100],"requiresWeapon":"spear","desc":"長矛專用技能，對全部敵人造成ATK500%傷害，並依STR增加傷害（STR120時+100%），需裝備矛類武器。"},
  counter: {"id":"counter","name":"反擊 Counter Attack","maxLv":10,"type":"passive","passiveStat":"counterAttack","element":"neutral","spCost":[0],"cooldown":[0],"mult":[15,18,21,24,27,29,31,33,35,35],"desc":"被攻擊時15%~35%機率完全迴避該次傷害並反擊一下必暴。"},
  sense: {"id":"sense","name":"怪物情報","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"fleeFlat","spCost":[0],"cooldown":[0],"mult":[10],"intBonus":[5],"desc":"被動技能，永久提升迴避+10、INT+5。"},
  firebolt_wiz: {"id":"firebolt_wiz","name":"火之獵殺","maxLv":10,"type":"passive","passiveStat":"onHitAoeProc","element":"fire","spCost":[0],"cooldown":[0],"requires":{"skillId":"sight","level":1},"procChance":[100,100,100,100,100,100,100,100,100,100],"mult":[1.2,1.4,1.6,1.8,2,2.2,2.4,2.6,2.8,3],"internalCooldown":[5,5,5,5,5,5,5,5,5,5],"desc":"被動技能，需先學會火狩。被攻擊時觸發，對場上全體敵人造成火屬性魔法傷害120%~300%（依等級），冷卻5秒。"},
  firepillar: {"id":"firepillar","name":"火柱攻擊","maxLv":10,"type":"passive","passiveStat":"onAttackAoeProc","element":"fire","spCost":[0],"cooldown":[0],"procChance":[30,30,30,30,30,30,30,30,30,30],"flatDmg":[150,200,250,300,350,400,450,500,550,600],"mult":[0.6,0.8,1,1.2,1.4,1.6,1.8,2,2.2,2.4],"internalCooldown":[5,5,5,5,5,5,5,5,5,5],"desc":"被動技能，普攻時有30%機率觸發，對場上全體敵人造成MATK150~600固定值+60%~240%的火屬性魔法傷害（依等級），冷卻5秒。"},
  meteorstorm: {"id":"meteorstorm","name":"隕石術","maxLv":10,"type":"field_aoe_magic","element":"fire","fieldTickIntervalSec":1,"spCost":[20,24,30,34,40,44,50,54,60,64],"cooldown":[5,5,5,5,5,5,5,5,5,5],"mult":[1.25,1.67,2.08,2.5,2.92,3.33,3.75,4.17,4.58,5],"duration":[3,3,3,3,3,3,3,3,3,3],"stunChance":[30,30,30,30,30,30,30,30,30,30],"stunSec":[2,2,2,2,2,2,2,2,2,2],"desc":"從天降下隕石，持續3秒每秒對範圍造成火屬性魔法傷害125%~500%（依等級），每次都有30%機率使敵人暈眩2秒。"},
  jupitel: {"id":"jupitel","name":"雷鳴術","maxLv":10,"type":"magic","element":"wind","spCost":[20,23,26,29,32,35,38,41,44,47],"cooldown":[8,8,8,8,8,8,8,8,8,8],"mult":[3,4,5,6,7,8,9,10,11,12],"stunOnHit":true,"stunSec":[3,3,3,3,3,3,3,3,3,3],"desc":"無視地形的雷電打擊，造成風屬性魔法傷害300%~1200%（依等級），並使目標暈眩3秒。"},
  lordofvermillion: {"id":"lordofvermillion","name":"怒雷強擊","maxLv":10,"type":"magic_aoe","element":"wind","spCost":[34,36,38,40,42,44,46,48,50,52],"cooldown":[3,3,3,3,3,3,3,3,3,3],"mult":[5,6,7,8,9,10,11,12,13,14],"stunChance":[60,60,60,60,60,60,60,60,60,60],"stunSec":[1,1,1,1,1,1,1,1,1,1],"desc":"從天空降下雷電，對範圍造成風屬性魔法傷害500%~1400%（依等級），並有60%機率使敵人暈眩1秒。"},
  waterball: {"id":"waterball","name":"水球術","maxLv":5,"type":"magic","element":"water","spCost":[20,20,20,20,20],"cooldown":[5,5,5,5,5],"mult":[2.5,4.375,6.25,8.125,10],"desc":"投擲水球攻擊敵人，造成水屬性魔法傷害250%~1000%（依等級）。"},
  icewall: {"id":"icewall","name":"冰刃之牆","maxLv":1,"type":"passive","passiveStat":"autoShield","element":"water","spCost":[0],"cooldown":[0],"shieldCapacityFlat":[1500],"shieldCharges":[5],"internalCooldown":[20],"desc":"被動技能，身上沒有護盾且冷卻完畢時，自動設置一層1500耐久、可擋5次的護盾，冷卻20秒。"},
  frostdiver_wiz: {"id":"frostdiver_wiz","name":"霜凍之術","maxLv":1,"type":"passive","passiveStat":"onHitAoeStunProc","element":"water","spCost":[0],"cooldown":[0],"procChance":[100],"mult":[1],"stunChance":[30],"stunSec":[1],"internalCooldown":[10],"desc":"被動技能，被攻擊時觸發，對場上全體敵人造成水屬性魔法傷害100%，並各有30%機率使其暈眩1秒，冷卻10秒。"},
  stormgust: {"id":"stormgust","name":"暴風雪","maxLv":10,"type":"field_aoe_magic","element":"water","fieldTickIntervalSec":1,"spCost":[40,40,40,40,40,42,42,42,42,42],"cooldown":[6,6,6,6,6,6,6,6,6,6],"mult":[1,1.44,1.89,2.33,2.78,3.22,3.67,4.11,4.56,5],"duration":[4,4,4,4,4,4,4,4,4,4],"stunChance":[60,60,60,60,60,60,60,60,60,60],"stunSec":[1,1,1,1,1,1,1,1,1,1],"desc":"召喚暴風雪，持續4秒每秒對範圍造成水屬性魔法傷害100%~500%（依等級），每次都有60%機率使敵人暈眩1秒。"},
  earthspike: {"id":"earthspike","name":"地震術","maxLv":5,"type":"magic","element":"earth","spCost":[14,18,22,26,30],"cooldown":[6,6,6,6,6],"mult":[2,4,6,8,10],"desc":"造成地屬性魔法傷害200%~1000%（依等級）。"},
  heavensdrive: {"id":"heavensdrive","name":"崩裂術","maxLv":5,"type":"field_aoe_magic","element":"earth","fieldTickIntervalSec":1,"spCost":[24,24,24,24,24],"cooldown":[6,6,6,6,6],"mult":[1,2,3,4,5],"duration":[3,3,3,3,3],"stunChance":[80,80,80,80,80],"stunSec":[0.5,0.5,0.5,0.5,0.5],"desc":"從天降下石塊，持續3秒每秒對範圍造成地屬性魔法傷害100%~500%（依等級），每次都有80%機率使敵人暈眩0.5秒。"},
  quagmire: {"id":"quagmire","name":"泥沼地","maxLv":1,"type":"passive","passiveStat":"onHitStunProc2","element":"earth","spCost":[0],"cooldown":[0],"procChance":[100],"stunSec":[0.5],"internalCooldown":[10],"desc":"被動技能，被攻擊時觸發，使攻擊者暈眩0.5秒，冷卻10秒。"},
  falcondelivery: {"id":"falcondelivery","name":"獵鷹尋敵","maxLv":4,"isQuest":true,"type":"passive","passiveStat":"critRate","spCost":[0],"cooldown":[0],"mult":[1,2,3,4],"desc":"被動技能，永久提升暴擊率+1%~4%。"},
  huntingmastery: {"id":"huntingmastery","name":"馴鷹術","maxLv":1,"type":"passive","passiveStat":"huntingMastery","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，本身無直接效果，需先學習才能點閃電衝擊。"},
  blitzbeat: {"id":"blitzbeat","name":"閃電衝擊","maxLv":5,"type":"damage_aoe","element":"wind","spCost":[18,18,18,18,18],"cooldown":[3,3,3,3,3],"mult":[1,2,3,4,5],"passiveMult":[0.4,0.8,1.2,1.6,2],"requires":{"skillId":"huntingmastery","level":1},"desc":"主動：召喚獵鷹範圍攻擊，ATK 100%~500%（依等級）。被動：普攻時依LUK機率額外觸發一次獵鷹單體攻擊，ATK最高40%~200%（依等級）。需先學會馴鷹術。"},
  falconnastery: {"id":"falconnastery","name":"鋼製喙","maxLv":10,"type":"passive","passiveStat":"falconFlatBonus","element":"neutral","spCost":[0],"cooldown":[0],"mult":[36,72,108,144,180,216,252,288,324,360],"desc":"被動技能，閃電衝擊（含被動觸發）傷害固定+36~360，不受倍率影響。"},
  trap: {"id":"trap","name":"地雷陷阱","maxLv":5,"type":"passive","passiveStat":"trapProc","trapEffect":"damage","element":"fire","spCost":[0],"cooldown":[0],"mult":[0.3,0.4,0.5,0.6,0.7],"procChance":[10,15,20,25,30],"internalCooldown":12,"desc":"被動技能，攻擊時機率觸發地雷陷阱，造成火屬性ATK 30%~70%直接傷害（冷卻12秒）。"},
  skidtrap: {"id":"skidtrap","name":"滑動陷阱","maxLv":5,"type":"passive","passiveStat":"trapProc","trapEffect":"stun","spCost":[0],"cooldown":[0],"stunSec":1,"procChance":[10,15,20,25,30],"internalCooldown":10,"desc":"被動技能，攻擊時機率觸發滑動陷阱，使敵人暈眩1秒（可與睡魔/定位陷阱疊加）（冷卻10秒）。"},
  flasher: {"id":"flasher","name":"強光陷阱","maxLv":5,"type":"passive","passiveStat":"trapProc","trapEffect":"hitDebuff","spCost":[0],"cooldown":[0],"hitDebuff":[20,30,40,50,60],"duration":[5,5,5,5,5],"procChance":[10,15,20,25,30],"internalCooldown":10,"desc":"被動技能，攻擊時機率觸發強光陷阱，使敵人命中下降20~60，持續5秒（冷卻10秒）。"},
  sleeptrap: {"id":"sleeptrap","name":"睡魔陷阱","maxLv":5,"type":"passive","passiveStat":"trapProc","trapEffect":"stun","spCost":[0],"cooldown":[0],"stunSec":1,"procChance":[10,15,20,25,30],"internalCooldown":10,"desc":"被動技能，攻擊時機率觸發睡魔陷阱，使敵人暈眩1秒（可與滑動/定位陷阱疊加）（冷卻10秒）。"},
  freezingtrap: {"id":"freezingtrap","name":"霜凍陷阱","maxLv":5,"type":"passive","passiveStat":"trapProc","trapEffect":"damage","element":"water","spCost":[0],"cooldown":[0],"mult":[0.3,0.4,0.5,0.6,0.7],"procChance":[10,15,20,25,30],"internalCooldown":10,"desc":"被動技能，攻擊時機率觸發霜凍陷阱，造成水屬性ATK 30%~70%直接傷害（冷卻10秒）。"},
  blastmine: {"id":"blastmine","name":"定時爆炸陷阱","maxLv":5,"type":"passive","passiveStat":"trapProc","trapEffect":"damage","element":"fire","spCost":[0],"cooldown":[0],"mult":[0.3,0.4,0.5,0.6,0.7],"internalCooldown":15,"desc":"被動技能，攻擊時必定觸發定時爆炸陷阱（無機率判定），造成火屬性ATK 30%~70%直接傷害（冷卻15秒）。"},
  claymoretrap: {"id":"claymoretrap","name":"定位陷阱","maxLv":5,"type":"passive","passiveStat":"trapProc","trapEffect":"stun","spCost":[0],"cooldown":[0],"stunSec":1,"procChance":[10,15,20,25,30],"internalCooldown":12,"desc":"被動技能，攻擊時機率觸發定位陷阱，使敵人暈眩1秒（可與滑動/睡魔陷阱疊加）（冷卻12秒）。"},
  magnumbreak_h: {"id":"magnumbreak_h","name":"爆散陷阱","maxLv":5,"type":"passive","passiveStat":"trapProc","trapEffect":"damageAoe","element":"fire","spCost":[0],"cooldown":[0],"mult":[0.2,0.3,0.4,0.5,0.6],"procChance":[10,15,20,25,30],"internalCooldown":12,"desc":"被動技能，攻擊時機率觸發爆散陷阱，對全體敵人造成火屬性ATK 20%~60%範圍傷害（冷卻12秒）。"},
  removetrap: {"id":"removetrap","name":"陷阱移除","maxLv":1,"type":"passive","passiveStat":"trapCdReduction","spCost":[0],"cooldown":[0],"mult":[3],"desc":"被動技能，所有陷阱被動的冷卻時間減少3秒。"},
  researchtrap: {"id":"researchtrap","name":"陷阱探查","maxLv":1,"type":"passive","passiveStat":"trapChanceBonus","spCost":[0],"cooldown":[0],"mult":[10],"desc":"被動技能，所有陷阱被動的觸發機率增加10%。"},
  animalslayer: {"id":"animalslayer","name":"動物殺手","maxLv":10,"type":"passive","passiveStat":"animalDamageFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[4,8,12,16,20,24,28,32,36,40],"desc":"被動技能，攻擊動物/昆蟲系怪物時固定傷害+4~40，不受DEF削減。"},
  weaponrepair: {"id":"weaponrepair","name":"武器修理","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[10],"critBonus":[3],"desc":"被動技能，永久提升ATK+10、爆擊率+3%。"},
  ironworking: {"id":"ironworking","name":"鐵製造","maxLv":1,"type":"passive","passiveStat":"materialCraft","craftCategory":"iron","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，解鎖鍛造頁面的「鐵」選項：消耗鐵礦石×1與500鋅幣，鍛造成鐵×1，成功率50%。"},
  steelworking: {"id":"steelworking","name":"鋼製造","maxLv":1,"type":"passive","passiveStat":"materialCraft","craftCategory":"steel","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，解鎖鍛造頁面的「鋼鐵」選項：消耗鐵×5、煤礦×1與500鋅幣，鍛造成鋼鐵×1，成功率50%。"},
  elementalstone: {"id":"elementalstone","name":"屬性石製造","maxLv":1,"type":"passive","passiveStat":"materialCraft","craftCategory":"stone","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，解鎖鍛造頁面的「屬性原石」選項：消耗同屬性礦石×10與500鋅幣，鍛造成對應屬性原石×1，成功率50%。"},
  oridecon: {"id":"oridecon","name":"神之金屬研究","maxLv":1,"type":"passive","passiveStat":"craftBonus","spCost":[0],"cooldown":[0],"mult":[5],"desc":"被動技能，永久提升鍛造武器成功率+5%。"},
  hiltbinding: {"id":"hiltbinding","name":"武器保有","maxLv":1,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[4],"strBonus":[1],"buffDurationBonusPct":[10],"desc":"被動技能，永久提升ATK+4、STR+1，並使速度激發與凶砍的持續時間+10%。"},
  findingore: {"id":"findingore","name":"尋找礦石","maxLv":1,"type":"passive","passiveStat":"findingoreProc","spCost":[0],"cooldown":[0],"procChance":[5],"desc":"被動技能，擊敗怪物時有5%機率額外獲得一顆隨機屬性礦石（風/水/火/地）。"},
  daggercraft: {"id":"daggercraft","name":"短劍製作","maxLv":1,"type":"passive","passiveStat":"weaponCraft","craftCategory":"dagger","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，解鎖短劍鍛造，基礎成功率15%（依DEX/LUK/神之金屬研究提升）。"},
  swordcraft: {"id":"swordcraft","name":"劍製作","maxLv":1,"type":"passive","passiveStat":"weaponCraft","craftCategory":"sword","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，解鎖單手劍與雙手劍鍛造，基礎成功率15%（依DEX/LUK/神之金屬研究提升）。"},
  axecraft: {"id":"axecraft","name":"斧頭製作","maxLv":1,"type":"passive","passiveStat":"weaponCraft","craftCategory":"axe","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，解鎖單手斧頭與雙手斧頭鍛造，基礎成功率15%（依DEX/LUK/神之金屬研究提升）。"},
  knucklecraft: {"id":"knucklecraft","name":"拳套製作","maxLv":1,"type":"passive","passiveStat":"weaponCraft","craftCategory":"knuckle","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，解鎖拳套鍛造，基礎成功率15%（依DEX/LUK/神之金屬研究提升）。"},
  macecraft: {"id":"macecraft","name":"鈍器製作","maxLv":1,"type":"passive","passiveStat":"weaponCraft","craftCategory":"mace","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，解鎖鈍器鍛造，基礎成功率15%（依DEX/LUK/神之金屬研究提升）。"},
  spearcraft: {"id":"spearcraft","name":"長矛製作","maxLv":1,"type":"passive","passiveStat":"weaponCraft","craftCategory":"spear","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，解鎖單手長矛與雙手長矛鍛造，基礎成功率15%（依DEX/LUK/神之金屬研究提升）。"},
  weaponresearch: {"id":"weaponresearch","name":"武器研究","maxLv":10,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[2,4,6,8,10,12,14,16,18,20],"hitBonus":[2,4,6,8,10,12,14,16,18,20],"craftBonusExtra":[1,2,3,4,5,6,7,8,9,10],"desc":"永久提升ATK與HIT各+2~20，並提升鍛造武器成功率+1%~10%（依等級）。"},
  hammerfall: {"id":"hammerfall","name":"大地之擊","maxLv":5,"type":"passive","passiveStat":"hammerfallProc","element":"earth","spCost":[0],"cooldown":[0],"singleStunChance":[10,12,15,18,20],"aoeStunChance":[5,6,7,8,10],"stunSec":[1,1,1,1,1],"requiresWeapon":"axemace","desc":"被動技能，裝備斧頭或鈍器攻擊時，10%~20%機率使目前敵人暈眩1秒，另有5%~10%機率使全體敵人暈眩1秒（依等級）。"},
  adrenaline: {"id":"adrenaline","name":"速度激發","maxLv":5,"type":"buff_aspd","spCost":[20,23,26,29,32],"cooldown":[30,60,90,120,150],"mult":[1.25,1.25,1.25,1.25,1.25],"bonusHit":[8,11,14,17,20],"duration":[30,60,90,120,150],"requiresWeapon":"axemace","desc":"斧頭／鈍器專用技能，使自身攻擊速度固定+25%，並提升HIT+8~20，持續30~150秒（依等級，需裝備斧頭或鈍器才能施放）。"},
  skintemper: {"id":"skintemper","name":"強化火屬性","maxLv":5,"type":"passive","passiveStat":"fireResist","spCost":[0],"cooldown":[0],"mult":[4,8,12,16,20],"neutralResistMult":[1,2,3,4,5],"desc":"被動技能，增加對火屬性傷害的耐性+4%~20%，對無屬性傷害的耐性+1%~5%（依等級）。"},
  cartrevo: {"id":"cartrevo","name":"手推車衝撞","maxLv":5,"type":"damage","element":"neutral","spCost":[22,22,22,22,22],"cooldown":[4,4,4,4,4],"mult":[1.5,1.8,2.1,2.4,2.7],"desc":"以滿載的推車強力衝撞（繼承自商人，非鐵匠本身技能，維持原樣）。"},
  overthrust: {"id":"overthrust","name":"無視體型攻擊","maxLv":5,"type":"passive","passiveStat":"sizeDamage","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1.05,1.1,1.15,1.2,1.25],"desc":"永久提升對大型怪物的傷害。（遊戲內尚無怪物體型判定機制，暫時擱置、無實際效果，保留供未來擴充）"},
  overthrustbuff: {"id":"overthrustbuff","name":"凶砍","maxLv":5,"type":"buff_atk","spCost":[18,16,14,12,10],"cooldown":[20,40,60,80,100],"mult":[1.05,1.1,1.15,1.2,1.25],"duration":[20,40,60,80,100],"desc":"短暫提升自身攻擊力+5%~25%，持續20~100秒（依等級）。"},
  maximize: {"id":"maximize","name":"武器值最大化","maxLv":5,"type":"buff_maxroll","spCost":[10,20,30,40,50],"cooldown":[30,30,30,30,30],"duration":[10,15,20,25,30],"desc":"短暫使武器傷害浮動值固定為最大值，持續10~30秒，消耗SP10~50（依等級）。"},
  weaponfusion: {"id":"weaponfusion","name":"詭計的商術","maxLv":1,"type":"passive","passiveStat":"zenyCostReduction","spCost":[0],"cooldown":[0],"mult":[20],"desc":"被動技能，使金錢攻擊的鋅幣消耗量-20%（手推車終結技留待未來新職業加入後再接上）。"},
  greed: {"id":"greed","name":"貪婪","maxLv":1,"type":"passive","passiveStat":"greedProc","spCost":[0],"cooldown":[0],"procChance":[10],"desc":"被動技能，擊敗怪物時有10%機率額外多獲得一份戰利品。"},
  rightmaster: {"id":"rightmaster","name":"右手修練","maxLv":5,"type":"passive","passiveStat":"rightHandPct","element":"neutral","spCost":[0],"cooldown":[0],"mult":[60,70,80,90,100],"desc":"雙持單手武器時，右手（主手）傷害修正60%→100%（未修練時僅50%）。"},
  leftmaster: {"id":"leftmaster","name":"左手修練","maxLv":5,"type":"passive","passiveStat":"leftHandPct","element":"neutral","spCost":[0],"cooldown":[0],"mult":[40,50,60,70,80],"desc":"雙持單手武器時，左手（副手）傷害修正40%→80%（未修練時僅30%）。"},
  katarmastery: {"id":"katarmastery","name":"拳刃修練","maxLv":10,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"requiresWeapon":"katar","desc":"永久提升拳刃攻擊力（需裝備拳刃才生效）。"},
  cloaking: {"id":"cloaking","name":"偽裝","maxLv":10,"type":"buff_flee","spCost":[10,10,10,10,10,12,12,12,12,12],"cooldown":[20,20,20,20,20,20,20,20,20,20],"mult":[1.3,1.35,1.4,1.45,1.5,1.55,1.6,1.65,1.7,1.75],"duration":[10,10,10,10,10,10,10,10,10,10],"desc":"偽裝成其他玩家，提升迴避。勾選自動施放後，偽裝生效中會自動連動施放無影之牙。"},
  sonicblow: {"id":"sonicblow","name":"音速投擲","maxLv":10,"type":"damage","element":"neutral","spCost":[16,16,16,16,16,18,18,18,18,18],"cooldown":[3,3,3,3,3,3,3,3,3,3],"mult":[3,4,5,6,7,8,9,10,11,12],"lowHpThreshold":0.5,"lowHpMult":1.5,"requiresWeapon":"katar","desc":"拳刃專屬技能，極速攻擊造成ATK 300%~1200%傷害；目標HP低於50%時傷害額外+50%。冷卻3秒，無法連續施放（需裝備拳刃才能施放）。"},
  grimtooth: {"id":"grimtooth","name":"無影之牙","maxLv":5,"type":"damage_aoe","element":"neutral","spCost":[14,14,14,14,14],"cooldown":[3,3,3,3,3],"mult":[1.2,1.4,1.6,1.8,2],"desc":"偽裝專屬技能，對目標與周圍怪物造成ATK 120%~200%範圍傷害。偽裝生效中會自動施放。"},
  enchantweapon: {"id":"enchantweapon","name":"塗毒","maxLv":10,"type":"buff_poison","element":"poison","spCost":[12,12,12,12,12,14,14,14,14,14],"cooldown":[10,10,10,10,10,10,10,10,10,10],"mult":[0.1,0.15,0.2,0.25,0.3,0.35,0.4,0.45,0.5,0.55],"duration":[8,8,8,8,8,8,8,8,8,8],"procChance":20,"desc":"輔助技能，施放後武器沾毒（持續8秒），生效中攻擊有20%機率使敵人中毒3秒，每秒造成ATK 10%~55%傷害（不會疊加）。毒屬性怪物免疫。"},
  poisonreact: {"id":"poisonreact","name":"毒性反彈","maxLv":10,"type":"passive","passiveStat":"poisonReact","element":"poison","spCost":[0],"cooldown":[0],"mult":[1,1.2,1.4,1.6,1.8,2,2.2,2.4,2.6,2.8],"internalCooldown":10,"desc":"被動技能，被毒屬性怪物攻擊時觸發反擊，造成ATK 100%~280%傷害（依等級，冷卻10秒）。目前遊戲中沒有毒屬性怪物，之後新增後才會實際觸發。"},
  venomdust: {"id":"venomdust","name":"病毒散播","maxLv":10,"type":"passive","passiveStat":"venomdustProc","element":"poison","spCost":[0],"cooldown":[0],"mult":[0.1,0.15,0.2,0.25,0.3,0.35,0.4,0.45,0.5,0.55],"internalCooldown":10,"desc":"被動技能，攻擊已中毒的敵人時，讓場上所有敵人一起陷入中毒，每秒造成ATK 10%~55%傷害（依等級，冷卻10秒）。"},
  venominfusion: {"id":"venominfusion","name":"毒性感染","maxLv":10,"type":"passive","passiveStat":"venominfusionProc","element":"poison","spCost":[0],"cooldown":[0],"mult":[0.2,0.4,0.6,0.8,1,1.2,1.4,1.6,1.8,2],"procChance":20,"internalCooldown":10,"desc":"被動技能，攻擊已中毒的敵人時有20%機率引爆，對全體敵人造成ATK 20%~200%範圍傷害（依等級，冷卻10秒）。"},
  sonicblow_max: {"id":"sonicblow_max","name":"超音速投擲","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"sonicblowBoost","element":"neutral","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，使用音速投擲時命中率修正+90%、傷害+90%。"},
  enchantblade: {"id":"enchantblade","name":"毒刃","maxLv":1,"type":"damage","element":"poison","spCost":[14],"cooldown":[5],"mult":[2],"desc":"用毒刃攻擊敵人。"},
  maceMastery: {"id":"maceMastery","name":"鈍器使用熟練度","maxLv":10,"isQuest":true,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"critBonus":[1,2,3,4,5,6,7,8,9,10],"requiresWeapon":"mace","desc":"永久提升鈍器攻擊力+3~30、爆擊率+1%~10%（依等級，需裝備鈍器才生效）。"},
  zenrecovery: {"id":"zenrecovery","name":"禪心","maxLv":10,"isQuest":true,"type":"passive","passiveStat":"zenRecovery","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"spPctBonus":[0.2,0.4,0.6,0.8,1,1.2,1.4,1.6,1.8,2],"itemEffectBonus":[10,20,30,40,50,60,70,80,90,100],"desc":"被動技能，永久提升SP自然恢復量+3~30與+0.2%~2%，並使SP恢復道具效果+10%~100%（依等級）。"},
  sanctuary: {"id":"sanctuary","name":"光耀之堂","maxLv":10,"type":"field_heal","fieldTickIntervalSec":1,"spCost":[15,18,21,24,27,30,33,36,39,42],"cooldown":[20,20,20,20,20,20,20,20,20,20],"healPerTick":[100,200,300,400,500,600,777,777,777,777],"duration":[4,7,10,13,16,19,22,25,28,31],"desc":"展開光耀之堂，使自身每秒恢復100~777點HP（依等級），持續4~31秒。（對不死種族造成額外傷害的部分因遊戲無種族系統，暫不實作）"},
  magnificat: {"id":"magnificat","name":"聖母之頌歌","maxLv":1,"type":"buff_sprate","spCost":[40],"cooldown":[45],"mult":[2],"duration":[30],"desc":"使自身SP自然恢復速度變為2倍，持續30秒。"},
  gloria: {"id":"gloria","name":"幸運之頌歌","maxLv":5,"type":"buff_lukflat","spCost":[20,20,20,20,20],"cooldown":[30,30,30,30,30],"lukBonus":[30,30,30,30,30],"duration":[10,15,20,25,30],"desc":"使自身LUK+30，持續10~30秒（依等級）。"},
  kyrie: {"id":"kyrie","name":"霸邪之陣","maxLv":10,"type":"buff_shield","spCost":[20,20,20,20,20,22,22,22,22,22],"cooldown":[15,15,15,15,15,15,15,15,15,15],"shieldCapacityPct":[12,14,16,18,20,22,24,26,28,30],"shieldCharges":[5,6,6,7,7,8,8,9,9,10],"duration":[120,120,120,120,120,120,120,120,120,120],"desc":"設置護盾，耐久度為最大HP的12%~30%，可抵擋5~10次物理傷害，最多持續2分鐘（依等級）。"},
  assumptio: {"id":"assumptio","name":"犧牲祈福","maxLv":3,"isQuest":true,"type":"passive","passiveStat":"aspdFlat","spCost":[0],"cooldown":[0],"mult":[1,2,3],"desc":"被動技能，永久提升ASPD+1~3（依等級）。"},
  sanctuary_holy: {"id":"sanctuary_holy","name":"聖之祈福","maxLv":1,"type":"buff_holyweapon","spCost":[15],"cooldown":[15],"duration":[10],"desc":"使自身武器暫時附加聖屬性，持續10秒。（對不死種族造成傷害的部分因遊戲無種族系統，暫不實作）"},
  resurrection: {"id":"resurrection","name":"復活術","maxLv":4,"isQuest":true,"type":"passive","passiveStat":"onDeathRevive1","spCost":[0],"cooldown":[0],"revivePct":[10,30,50,80],"internalCooldown":[120,100,80,60],"reviveSpCost":[60,60,60,60],"desc":"被動技能，HP歸零時原地復活並恢復10%~80%HP（依等級），消耗SP60，冷卻120~60秒。"},
  impositio: {"id":"impositio","name":"沉默之術","maxLv":5,"type":"debuff","spCost":[20,17,15,13,10],"cooldown":[5,5,5,5,5],"successChance":[50,50,50,50,50],"duration":[10,15,20,25,30],"desc":"使目標陷入沉默，無法使用技能，持續10~30秒，成功率50%（依等級）。（遊戲尚未實裝異常狀態系統，此技能暫時擱置、無實際效果）"},
  turnundead: {"id":"turnundead","name":"轉生術","maxLv":10,"type":"magic","element":"holy","spCost":[15,15,15,15,15,17,17,17,17,17],"cooldown":[3,3,3,3,3,3,3,3,3,3],"mult":[1,1.22,1.44,1.67,1.89,2.11,2.33,2.56,2.78,3],"levelScaleMax":100,"intScaleMax":50,"desc":"對目標造成100%~300%聖屬性魔法傷害（依等級），並依基本等級(最高+100%，99級)與INT(最高+50%，INT99)增加傷害。（對不死種族秒殺的部分因遊戲無種族系統，暫不實作）"},
  angelus: {"id":"angelus","name":"天使之怒","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"angelusProc","spCost":[0],"cooldown":[0],"angelusCooldownSec":10,"desc":"被動技能，每10秒下一次攻擊會造成雙倍傷害。"},
  asperio: {"id":"asperio","name":"十字驅魔攻擊","maxLv":10,"type":"field_aoe_magic","element":"holy","fieldTickIntervalSec":3,"spCost":[40,42,44,46,48,50,52,54,56,58],"cooldown":[15,15,15,15,15,15,15,15,15,15],"mult":[1,2,3,4,5,6,7,8,9,10],"duration":[12,12,12,12,12,12,12,12,12,12],"desc":"在原地造成持續範圍聖屬性魔法傷害，每3秒一次，共持續12秒，每次傷害為MATK 100%~1000%（依等級）。"},
  suffragium: {"id":"suffragium","name":"捨身取義","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"onDeathRevive2","spCost":[0],"cooldown":[0],"revivePct":[50],"internalCooldown":[300],"desc":"被動技能，HP歸零時原地復活並恢復50%HP，冷卻300秒（若復活術可用會優先觸發復活術）。"},
  darkbarrier: {"id":"darkbarrier","name":"暗之障壁","maxLv":10,"type":"buff_shield","spCost":[30,30,30,35,35,35,40,40,40,40],"cooldown":[10,10,10,10,10,10,10,10,10,10],"shieldCapacityFlat":[300,600,900,1200,1500,1800,2100,2400,2700,3000],"shieldCharges":[2,3,4,5,6,7,8,9,10,11],"duration":[5,10,15,20,25,30,35,40,45,50],"desc":"設置魔法障壁，耐久度300~3000（依等級），可抵擋2~11次近距離物理傷害，持續5~50秒。"},

  /* ---- 卡片自動念咒／賦予技能需要的技能本體（#22）----
     這幾個官方技能本作原本沒有，所以那批卡片一直卡在「框架好了但沒有技能可放」。
     **刻意不掛在任何職業的技能表下**——只有卡片用得到，玩家學不到也加不了點。
     `castSkill(id, {free:true})` 與 `findSkillForUse()` 都是查 SKILLS，不必進職業樹。

     其中三個現在做得到，是因為需要的東西後來才補上：解除增益要有 `mon.mbuff`（#45）、
     痊癒術要有 `state.playerAil`（#30）、冷笑話要有怪物異常狀態（#29）。
     這些在 #22 寫下時都還不存在。 */
  frostjoke: {"id":"frostjoke","name":"冷笑話","maxLv":5,"type":"ailment_aoe","element":"water","ailment":"freeze","successChance":[15,20,25,30,35],"spCost":[10,10,10,10,10],"cooldown":[10,10,10,10,10],"desc":"講一個冷到結凍的笑話，對全部敵人各有15%~35%機率造成冰凍（依等級）。"},
  impositio_manus: {"id":"impositio_manus","name":"神威祈福","maxLv":5,"type":"buff_atk","spCost":[20,20,20,20,20],"cooldown":[30,30,30,30,30],"mult":[1.05,1.1,1.15,1.2,1.25],"duration":[60,60,60,60,60],"desc":"祝福自身，攻擊力+5%~25%，持續60秒（依等級）。（官方是固定值 ATK+5×等級，本作的攻擊力buff一律是倍率制，改成等效的百分比）"},
  autoguard: {"id":"autoguard","name":"自動防禦","maxLv":10,"type":"buff_block","spCost":[10,10,10,10,10,12,12,12,12,12],"cooldown":[15,15,15,15,15,15,15,15,15,15],"blockChance":[5,10,15,20,25,30,35,40,45,50],"duration":[20,20,20,20,20,30,30,30,30,30],"desc":"進入防禦姿態，有5%~50%機率完全擋下敵人的物理攻擊，持續20~30秒（依等級）。"},
  grandcross: {"id":"grandcross","name":"聖十字審判","maxLv":10,"type":"magic_aoe","element":"holy","spCost":[37,40,43,46,49,52,55,58,61,64],"cooldown":[8,8,8,8,8,8,8,8,8,8],"mult":[1.4,1.8,2.2,2.6,3,3.4,3.8,4.2,4.6,5],"desc":"以聖十字之力對全部敵人造成聖屬性魔法傷害MATK×140%~500%（依等級）。（官方會同時傷到自己，本作不做——放置遊戲裡自傷技能只會被玩家關掉）"},
  dispell_magic: {"id":"dispell_magic","name":"魔法效果解除","maxLv":5,"type":"dispel_aoe","spCost":[35,35,35,35,35],"cooldown":[20,20,20,20,20],"aoeFromLv":3,"desc":"解除敵人身上的增益效果（力量提升、自動防禦、反射盾那一類）。Lv3以上對全體生效。"},
  strecovery: {"id":"strecovery","name":"痊癒術","maxLv":1,"type":"cure","spCost":[25],"cooldown":[15],"desc":"解除自身的昏迷、冰凍、石化、睡眠、混亂、沉默、黑暗、詛咒、中毒、出血。"},

  /* ---------------- 領主騎士（進階二轉，第一批 6 個）----------------
     官方 skill id 對照（用 id 不用中文名——不同版本的譯名會對調）：
       LK_BERSERK      狂怒之槍   LK_TENSIONRELAX 極速回復
       LK_PARRYING     雙劍挌擋   LK_HEADCRUSH    傷害增壓
       LK_JOINTBEAT    巧打       LK_SPIRALPIERCE 螺旋擊刺
     還沒做的兩個：LK_AURABLADE 靈氣劍、LK_CONCENTRATION 集中攻擊 */

  lk_berserk: {
    id: 'lk_berserk', name: '狂怒之槍 Frenzy', maxLv: 1,
    type: 'passive', passiveStat: 'frenzyProc',
    spCost: [0], cooldown: [0],
    procChance: [10], mult: [2], aspdFlat: [2], duration: [10], internalCooldown: [30],
    desc: '被動技能。受到攻擊時 10% 機率進入狂怒，ATK ×2、ASPD +2，持續 10 秒（內部冷卻 30 秒）。'
        + '（官方是主動技能，代價是持續掉血、不能喝水也不能用技能；本作依使用者指定改成受擊觸發的被動，代價換成低觸發率與冷卻）'
  },
  lk_tensionrelax: {
    id: 'lk_tensionrelax', name: '極速回復 Tension Relax', maxLv: 1,
    type: 'passive', passiveStat: 'regenDoubleProc',
    spCost: [0], cooldown: [0],
    procChance: [30], mult: [2],
    desc: '被動技能。自然回復 HP 時 30% 機率回復量加倍，沒有冷卻。'
        + '（官方是「坐下時 HP 恢復加速」，放置遊戲沒有坐下這個動作，改成掛在自然回復上）'
  },
  lk_parrying: {
    id: 'lk_parrying', name: '雙劍挌擋 Parrying', maxLv: 10,
    type: 'passive', passiveStat: 'parryingProc',
    spCost: [0], cooldown: [0], requiresWeapon: 'sword2',
    mult: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
    desc: '被動技能，需裝備雙手劍。有 10%~55% 機率完全擋下敵人的物理攻擊（魔法不擋）。'
  },
  /* 傷害增壓與巧打依使用者指定改成**普攻觸發的被動**（原本是主動技）。
     兩者共用 `onAttackStrikeProc` 這個型別：普攻命中後擲一次，中了就補一段傷害＋異常狀態，
     各自有獨立的內部冷卻。改成被動之後 SP 成本沒有意義，一律 0。 */
  lk_headcrush: {
    id: 'lk_headcrush', name: '傷害增壓 Head Crush', maxLv: 5,
    type: 'passive', passiveStat: 'onAttackStrikeProc', element: 'neutral',
    spCost: [0], cooldown: [0],
    procChance: [5, 10, 15, 20, 25], internalCooldown: [5, 5, 5, 5, 5],
    mult: [1.4, 1.8, 2.2, 2.6, 3.0],
    inflict: { type: 'bleed', chance: [100, 100, 100, 100, 100] },
    desc: '被動技能。普通攻擊有 5%~25% 機率追加一次 ATK×140%~300% 的重擊並使目標出血（內部冷卻 5 秒）。'
  },
  lk_jointbeat: {
    id: 'lk_jointbeat', name: '巧打 Joint Beat', maxLv: 10,
    type: 'passive', passiveStat: 'onAttackStrikeProc', element: 'neutral',
    spCost: [0], cooldown: [0], requiresWeapon: 'spear',
    procChance: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    internalCooldown: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    mult: [1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.3, 3.6, 4.0],
    inflict: { type: 'stun+blind+curse+bleed', chance: [100, 100, 100, 100, 100, 100, 100, 100, 100, 100] },
    desc: '被動技能，需裝備矛類武器。普通攻擊有 3%~30% 機率追加一次 ATK×120%~400% 的關節打擊，'
        + '並隨機造成昏迷／黑暗／詛咒／出血其中一種（內部冷卻 5 秒）。'
        + '（官方是依部位給不同減益：腳踝降移速、手腕降攻速、膝肩腰頸各有效果；本作沒有部位概念，改成從性質最接近的四種異常狀態隨機挑一種）'
  },
  lk_spiralpierce: {
    id: 'lk_spiralpierce', name: '螺旋擊刺 Spiral Pierce', maxLv: 5,
    type: 'damage', element: 'neutral',
    spCost: [20, 22, 24, 26, 28], cooldown: [6, 6, 6, 6, 6],
    /* 官方每段倍率是 (100 + 50×等級)%，**而且會打 5 段**＝總倍率 750%~1750%。
       本作沒有多段攻擊的呈現，使用者 2026-08-08 指定「直接把倍率 ×5」，
       所以這裡寫的是**官方的總倍率**，一次打完。 */
    mult: [7.5, 10.0, 12.5, 15.0, 17.5],
    requiresWeapon: 'spear',
    // 官方係數就是 0.8，乘的是**顯示重量**（引擎會把 ITEMS.weight 的 ×10 原始值除回來）
    weaponWeightMult: [0.8, 0.8, 0.8, 0.8, 0.8],
    ignoreSize: true,
    desc: '矛類專用。旋轉貫穿造成 ATK×750%~1750% 傷害，額外加上「武器重量×0.8」的攻擊力，且無視體型懲罰。'
        + '（官方是每段 150%~350% 打 5 段，本作沒有多段呈現，直接合成一次打完）'
  },
  lk_aurablade: {
    id: 'lk_aurablade', name: '靈氣劍 Aura Blade', maxLv: 5,
    type: 'buff_auraflat', element: 'neutral',
    spCost: [20, 25, 30, 35, 40], cooldown: [30, 30, 30, 30, 30],
    // 官方：每次攻擊附加 20×等級 的固定傷害，**無視防禦**
    flatDmg: [20, 40, 60, 80, 100],
    duration: [60, 90, 120, 150, 180],
    desc: '劍上纏繞靈氣，每次攻擊額外附加 20~100 點固定傷害且無視防禦，持續 60~180 秒。'
  },
  lk_concentration: {
    id: 'lk_concentration', name: '集中攻擊 Concentration', maxLv: 5,
    type: 'buff_atk', element: 'neutral',
    spCost: [20, 24, 28, 32, 36], cooldown: [30, 30, 30, 30, 30],
    // 官方：ATK +5×等級%，代價是 DEF −5×等級%
    mult: [1.05, 1.10, 1.15, 1.20, 1.25],
    defMult: [0.95, 0.90, 0.85, 0.80, 0.75],
    duration: [30, 45, 60, 75, 90],
    desc: '集中精神提升攻擊力 5%~25%，代價是防禦力下降 5%~25%，持續 30~90 秒。'
  },

  /* ---------------- 十字刺客 Assassin Cross（#59）----------------

     官方 6 個技能，`ASC_HALLUCINATION`（幻影步）**使用者指定刪除**——
     官方資料本身就是空的（maxLv −1、沒有說明），那是個沒實裝的殘留條目，
     真正有效果的「幻影步」是三轉十字斬首者的 GC_HALLUCINATIONWALK。

     官方 id 對照（用 id 不用中文名，譯名在不同版本會對調）：
       ASC_KATAR         高階拳刃修練  → asc_katar
       ASC_CDP           毒液製作      → asc_cdp
       ASC_EDP           致命塗毒      → asc_edp
       ASC_BREAKER       心靈震波      → asc_breaker
       ASC_METEORASSAULT 黑暗瞬間      → asc_meteorassault           */

  // 官方：拳刃攻擊時物理傷害 +12/14/16/18/20%（傷害%，不是 ATK 固定值——那是二轉的拳刃修練）
  asc_katar: {
    id: 'asc_katar', name: '高階拳刃修練 Advanced Katar Mastery', maxLv: 5,
    type: 'passive', passiveStat: 'physDmgPct', element: 'neutral',
    spCost: [0], cooldown: [0],
    requiresWeapon: 'katar',
    mult: [12, 14, 16, 18, 20],
    desc: '被動技能，裝備拳刃時物理傷害 +12%~20%（普通攻擊與物理技能都適用）。'
  },

  /* 官方是主動的製作技能。本作的製作一律走鍛造頁面（跟鐵/鋼/屬性原石同一套），
     所以做成「解鎖一道配方」的被動。七種材料照官方一項不減，成功率 25%（使用者指定）。 */
  asc_cdp: {
    id: 'asc_cdp', name: '毒液製作 Create Deadly Poison', maxLv: 1,
    type: 'passive', passiveStat: 'materialCraft', craftCategory: 'poison',
    element: 'neutral', spCost: [0], cooldown: [0], mult: [1],
    desc: '被動技能，解鎖鍛造頁面的「毒藥瓶」配方：消耗毒牙、仙人掌刺、蜂針、毒魔菇芽孢、卡勒波迪藥水、菠色克藥水、空瓶各×1，成功率 25%（失敗材料照樣消耗）。毒藥瓶是致命塗毒的發動條件。'
  },

  /* 官方是主動 buff、消耗毒藥瓶×1、自己讓對方中毒。
     使用者改成**被動**且反過來：打到已經中毒的敵人時觸發，毒藥瓶只當門票不消耗。
     裝備ATK 倍率沿用官方 280~400%，持續與冷卻改成 10 秒 / 30 秒。 */
  asc_edp: {
    id: 'asc_edp', name: '致命塗毒 Enchant Deadly Poison', maxLv: 5,
    type: 'passive', passiveStat: 'edpProc', element: 'poison',
    spCost: [0], cooldown: [0],
    mult: [2.8, 3.1, 3.4, 3.7, 4.0],   // 裝備（武器）ATK 倍率
    poisonDmgMult: [2, 2, 2, 2, 2],    // 毒屬性傷害 +100%
    duration: [10, 10, 10, 10, 10],
    internalCooldown: [30, 30, 30, 30, 30],
    desc: '被動技能，攻擊已中毒的敵人時發動（身上需有毒藥瓶，不會消耗）：裝備ATK ×280%~400%、毒屬性傷害 +100%，持續 10 秒，冷卻 30 秒。'
  },

  /* 官方：遠距離物理單體，ATK 150%~1500%，傷害隨基本等級與 INT 增加，
     「以暴擊率的一半判定暴擊，且暴擊加成只有一半」——critRateMult / critDmgMult 就是為它做的。 */
  asc_breaker: {
    id: 'asc_breaker', name: '心靈震波 Soul Destroyer', maxLv: 10,
    type: 'damage', element: 'neutral',
    spCost: [24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
    cooldown: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
    mult: [1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5, 15],
    levelScaleMax: 50, intScaleMax: 50,
    critRateMult: 0.5, critDmgMult: 0.5,
    desc: '對目標造成 ATK 150%~1500% 傷害，並依基本等級（最高+50%）與 INT（最高+50%，INT99）額外增傷。以暴擊率的一半判定暴擊，暴擊加成也只有一半。'
  },

  /* 官方是主動範圍技，使用者改成**普攻 20% 機率觸發的被動**。
     倍率與異常狀態機率照官方逐級值，沒有內部冷卻（20% 已經是節流）。 */
  asc_meteorassault: {
    id: 'asc_meteorassault', name: '黑暗瞬間 Meteor Assault', maxLv: 10,
    type: 'passive', passiveStat: 'onAttackPhysAoeProc', element: 'neutral',
    spCost: [0], cooldown: [0],
    procChance: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    mult: [3.2, 4.4, 5.6, 6.8, 8.0, 9.2, 10.4, 11.6, 12.8, 14.0],
    inflict: { type: 'stun+blind+bleed', chance: [10, 15, 20, 25, 30, 35, 40, 45, 50, 55] },
    desc: '被動技能，普通攻擊時 20% 機率對全體敵人造成 ATK 320%~1400% 傷害，並有 10%~55% 機率使目標陷入暈眩、黑暗或出血。'
  },

  /* ---------------- 神匠 Whitesmith（#60）----------------

     官方 8 個，`WS_CREATECOIN`（金錢鑄造）／`WS_CREATENUGGET`（金屬塊製造）／
     `WS_SYSTEMCREATE`（攻擊塔製作）**使用者指定刪除**——官方資料本身就是空的
     （`maxLv: -1`、沒有任何效果說明），跟十字刺客的幻影步同一種殘留條目。

     官方 id 對照：
       WS_WEAPONREFINE    武器精煉      → ws_weaponrefine
       WS_CARTBOOST       手推車加速    → ws_cartboost
       WS_CARTTERMINATION 手推車終結技  → ws_cartterm
       WS_MELTDOWN        野蠻凶砍      → ws_meltdown
       WS_OVERTHRUSTMAX   凶砍最大值    → ws_overthrustmax                */

  // 官方是「自己也能精煉，JOB50 後每級 +0.5%」。本作本來就是自己按精煉，
  // 那半邊的價值天生沒有，所以只留成功率加成（使用者指定 Lv10 給 +10%）
  ws_weaponrefine: {
    id: 'ws_weaponrefine', name: '武器精煉 Weapon Refine', maxLv: 10,
    type: 'passive', passiveStat: 'refineBonus', element: 'neutral',
    spCost: [0], cooldown: [0],
    mult: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    desc: '被動技能，裝備精煉的成功率 +1%~+10%（武器與防具都算，加在官方機率之上）。'
  },

  /* 官方是移速 +20%、持續 60 秒的主動 buff。本作沒有移動，比照騎乘術與月夜貓
     改成**生怪加速**；使用者指定做成會自己續的被動：60 秒持續、10 秒冷卻。 */
  ws_cartboost: {
    id: 'ws_cartboost', name: '手推車加速 Cart Boost', maxLv: 1,
    type: 'passive', passiveStat: 'cartBoost', element: 'neutral',
    spCost: [0], cooldown: [0],
    mult: [1.2],
    duration: [60], internalCooldown: [10],
    desc: '被動技能，自動發動：生怪速度 +20%，持續 60 秒，結束後 10 秒再次發動。與騎乘術、月夜貓卡片相乘。'
  },

  /* 官方傷害是「推車重量 ÷ 15~÷6」。本作沒有負重系統，使用者指定改成固定倍率
     500%~1500%，並且**商人的負重量上升照樣加強它**（跟金錢攻擊、手推車攻擊同一條）。
     暈眩機率與鋅幣消耗照官方逐級值。 */
  ws_cartterm: {
    id: 'ws_cartterm', name: '手推車終結技 Cart Termination', maxLv: 10,
    type: 'damage', element: 'neutral',
    spCost: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
    cooldown: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    mult: [5, 6.1, 7.2, 8.3, 9.4, 10.6, 11.7, 12.8, 13.9, 15],
    zenyCost: [600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500],
    inflict: { type: 'stun', chance: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] },
    desc: '消耗 600~1500 鋅幣以手推車撞擊目標，造成 ATK 500%~1500% 傷害，5%~50% 機率使其暈眩。傷害會被「負重量上升」加強。'
  },

  /* 官方效果有兩半：打玩家破壞武器／鎧甲、打怪物降其物攻／物防。
     **前一半本作永久 N/A**（裝備不會損壞），只做後一半，
     機率沿用官方那兩欄（武器損壞→降物攻、鎧甲損壞→降物防）。 */
  ws_meltdown: {
    id: 'ws_meltdown', name: '野蠻凶砍 Meltdown', maxLv: 10,
    type: 'buff_meltdown', element: 'neutral',
    spCost: [50, 50, 60, 60, 70, 70, 80, 80, 90, 90],
    cooldown: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
    duration: [15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
    atkBreakChance: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    defBreakChance: [0.7, 1.4, 2.1, 2.8, 3.5, 4.2, 4.9, 5.6, 6.3, 7.0],
    debuffMult: 0.8, debuffSec: 10,       // 本作自訂：中了就 −20%，持續 10 秒
    desc: '持續 15~60 秒，期間普通攻擊有 1%~10% 機率使目標物攻 −20%、0.7%~7% 機率使目標物防 −20%（各持續 10 秒）。'
  },

  // 官方：消耗 3000~5000 鋅幣，ATK +20%~100%，持續 3 分鐘
  ws_overthrustmax: {
    id: 'ws_overthrustmax', name: '凶砍最大值 Maximum Overthrust', maxLv: 5,
    type: 'buff_atk', element: 'neutral',
    spCost: [15, 15, 15, 15, 15], cooldown: [180, 180, 180, 180, 180],
    mult: [1.2, 1.4, 1.6, 1.8, 2.0],
    duration: [180, 180, 180, 180, 180],
    zenyCost: [3000, 3500, 4000, 4500, 5000],
    desc: '消耗 3000~5000 鋅幣，攻擊力 +20%~100%，持續 3 分鐘。'
  },

  /* ---------------- 狙擊之王 Sniper（#61）----------------

     官方 4 個，全部做。id 對照：
       SN_WINDWALK       風之步      → sn_windwalk
       SN_SHARPSHOOTING  銳利射擊    → sn_sharpshooting
       SN_SIGHT          狙殺瞄準    → sn_sight
       SN_FALCONASSAULT  獵鷹突擊    → sn_falconassault                    */

  /* 官方：自身與隊友移速 +2~20%、FLEE +1~5，持續 130~400 秒。
     本作沒有移動也沒有隊友——移速照既定慣例（騎乘術／月夜貓／手推車加速）
     改成**生怪加速**，使用者 2026-08-09 指定照做。 */
  sn_windwalk: {
    id: 'sn_windwalk', name: '風之步 Wind Walk', maxLv: 10,
    type: 'buff_windwalk', element: 'neutral',
    spCost: [46, 52, 58, 64, 70, 76, 82, 88, 94, 100],
    cooldown: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
    mult: [1.02, 1.04, 1.06, 1.08, 1.10, 1.12, 1.14, 1.16, 1.18, 1.20],
    fleeFlat: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    duration: [130, 160, 190, 220, 250, 280, 310, 340, 370, 400],
    desc: '生怪速度 +2%~20%、迴避 +1~5，持續 130~400 秒。（官方是移動速度，本作沒有移動，比照騎乘術改成生怪加速）'
  },

  /* 官方：遠距離物理範圍技，ATK 600%~1800%，依基本等級遞增，
     「以暴擊率 +50 判定暴擊，暴擊加成只有一半」——本作唯一會暴擊的範圍技。 */
  sn_sharpshooting: {
    id: 'sn_sharpshooting', name: '銳利射擊 Sharp Shooting', maxLv: 5,
    type: 'damage_aoe', element: 'neutral',
    spCost: [16, 18, 20, 22, 24], cooldown: [5, 5, 5, 5, 5],
    mult: [6, 9, 12, 15, 18],
    levelScaleMax: 50,
    critRateFlat: 50, critDmgMult: 0.5,
    requiresWeapon: 'bow',
    desc: '對全體敵人造成 ATK 600%~1800% 遠距離物理傷害，依基本等級最高再 +50%。以自身暴擊率 +50 判定暴擊，暴擊加成只有一半。需裝備弓。'
  },

  // 官方：30 秒內全素質 +5、ATK +2~20%、CRI +1~10、HIT +3~30
  sn_sight: {
    id: 'sn_sight', name: '狙殺瞄準 True Sight', maxLv: 10,
    type: 'buff_sight', element: 'neutral',
    spCost: [20, 20, 25, 25, 30, 30, 35, 35, 40, 40],
    cooldown: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    mult: [1.02, 1.04, 1.06, 1.08, 1.10, 1.12, 1.14, 1.16, 1.18, 1.20],
    allStat: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    critFlat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    hitFlat: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    duration: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    desc: '全素質 +5、攻擊力 +2%~20%、暴擊率 +1~10、命中 +3~30，持續 30 秒。'
  },

  /* 官方**沒有給 ATK% 欄位**——傷害是從閃電衝擊推導的
     （「依技能等級、施展者的閃電衝擊傷害、鋼製喙等級和基本等級而增加」）。
     所以 `mult` 是**係數**：乘上閃電衝擊當前等級的倍率，鋼製喙的固定傷害也照同係數放大。
     INT 遞增是使用者 2026-08-09 指定補的——官方獵鷹系列的傷害本來就吃 INT。 */
  sn_falconassault: {
    id: 'sn_falconassault', name: '獵鷹突擊 Falcon Assault', maxLv: 5,
    type: 'damage', element: 'neutral',
    spCost: [30, 34, 38, 42, 46], cooldown: [4, 4, 4, 4, 4],
    mult: [2.0, 2.5, 3.0, 3.5, 4.0],     // 係數，不是 ATK 倍率
    levelScaleMax: 50, intScaleMax: 100,
    requires: { skillId: 'blitzbeat', level: 1 },
    desc: '單體重擊。傷害＝閃電衝擊當前等級的倍率 ×2.0~4.0，鋼製喙的固定傷害同樣放大，另依基本等級（最高+50%）與 INT（最高+100%，INT99）遞增。閃電衝擊與鋼製喙練得越滿，這一招越強。'
  },

  /* ---------------- 高等巫師 High Wizard（#63）----------------

     官方 6 個，全部做。id 對照：
       HW_GANBANTEIN     咖般塔音    → hw_ganbantein
       HW_NAPALMVULCAN   念力連擊    → hw_napalmvulcan
       HW_SOULDRAIN      吸魂術      → hw_souldrain
       HW_MAGICCRASHER   魔擊術      → hw_magiccrasher
       HW_MAGICPOWER     魔力增幅    → hw_magicpower
       HW_GRAVITATION    重力原野    → hw_gravitation                     */

  /* 官方是「消耗藍/黃魔力礦石各 1，80% 消除 3×3 的地面效果」。
     本作的地面效果全是玩家自己放的，怪物又沒有地面技能（#36 已列永久 N/A）——
     等於沒有可以作用的對象。使用者改成「普攻機率全體暈眩」。
     礦石**照官方消耗**（使用者 2026-08-09 定案）：全場 50% 暈眩太強，要有持續成本，
     所以這一招的續航直接綁在礦石庫存上。 */
  hw_ganbantein: {
    id: 'hw_ganbantein', name: '咖般塔音 Ganbantein', maxLv: 1,
    type: 'passive', passiveStat: 'ganbanteinProc', element: 'neutral',
    spCost: [0], cooldown: [0],
    procChance: [50], stunSecMin: 1, stunSecMax: 2, internalCooldown: [10],
    mult: [1],
    // desc 是直接印在技能分頁的純文字，不吃 markdown——別用 ** 強調
    desc: '被動技能，普通攻擊時發動：消耗藍色魔力礦石與黃色魔力礦石各 1 個，讓場上每一隻敵人各有 50% 機率暈眩 1~2 秒。冷卻 10 秒，礦石不夠就不會發動。'
  },

  // 官方：念屬性範圍魔法，MATK 70%~1750%，5%~25% 機率詛咒，依基本等級遞增
  hw_napalmvulcan: {
    id: 'hw_napalmvulcan', name: '念力連擊 Napalm Vulcan', maxLv: 5,
    type: 'magic_aoe', element: 'ghost',
    spCost: [30, 40, 50, 60, 70], cooldown: [4, 4, 4, 4, 4],
    mult: [0.7, 2.8, 6.3, 11.2, 17.5],
    levelScaleMax: 50,
    inflict: { type: 'curse', chance: [5, 10, 15, 20, 25] },
    desc: '對全體敵人造成 MATK 70%~1750% 念屬性魔法傷害，並有 5%~25% 機率使其陷入詛咒。依基本等級最高再 +50%。'
  },

  /* 官方是「最大SP +2~20%，用單體魔法或普攻擊殺時依對方等級回 SP（110~245%）」。
     使用者改成固定 5~50 SP、不分擊殺方式——killMonster() 不知道是誰打死的，
     要傳「擊殺來源」得動到十幾個呼叫點，代價跟收益不成比例。 */
  hw_souldrain: {
    id: 'hw_souldrain', name: '吸魂術 Soul Drain', maxLv: 10,
    type: 'passive', passiveStat: 'soulDrain', element: 'neutral',
    spCost: [0], cooldown: [0],
    mult: [1.02, 1.04, 1.06, 1.08, 1.10, 1.12, 1.14, 1.16, 1.18, 1.20],
    spOnKill: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    desc: '被動技能，最大SP +2%~20%，且每次擊敗敵人回復 5~50 SP。'
  },

  /* 官方是主動技：「拿 MATK 當數值、但走**遠距離物理**傷害流程」。
     使用者改成普攻 20% 觸發的被動，冷卻 5 秒。
     傷害源是 MATK、減傷走物理防禦——本作第一個把這兩件事拆開的技能。 */
  hw_magiccrasher: {
    id: 'hw_magiccrasher', name: '魔擊術 Magic Crasher', maxLv: 1,
    type: 'passive', passiveStat: 'magicCrasherProc', element: 'neutral',
    spCost: [0], cooldown: [0],
    procChance: [20], internalCooldown: [5], mult: [1],
    desc: '被動技能，普通攻擊時 20% 機率追加一發 MATK 100% 的傷害（吃物理防禦，不吃魔防）。冷卻 5 秒。'
  },

  // 官方：自身強化 60 秒，MATK +5%~50%
  hw_magicpower: {
    id: 'hw_magicpower', name: '魔力增幅 Mystical Amplification', maxLv: 10,
    type: 'buff_matk', element: 'neutral',
    spCost: [35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
    cooldown: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
    mult: [1.05, 1.10, 1.15, 1.20, 1.25, 1.30, 1.35, 1.40, 1.45, 1.50],
    duration: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
    desc: '魔法攻擊力 +5%~50%，持續 60 秒。'
  },

  /* 官方是「MATK 100~500% × 2/4/6/8/10 次」。本作沒有多段呈現，
     使用者指定**直接把次數乘進倍率**（跟螺旋擊刺 #58 同一個處理）：
     1.0×2 / 2.0×4 / 3.0×6 / 4.0×8 / 5.0×10 = 2 / 8 / 18 / 32 / 50。 */
  hw_gravitation: {
    id: 'hw_gravitation', name: '重力原野 Gravitation Field', maxLv: 5,
    type: 'magic_aoe', element: 'neutral',
    spCost: [60, 70, 80, 90, 100], cooldown: [10, 10, 10, 10, 10],
    mult: [2, 8, 18, 32, 50],
    levelScaleMax: 50,
    desc: '對全體敵人造成 MATK 200%~5000% 無屬性魔法傷害（官方是 100%~500% 打 2~10 次，本作合成一次打完），依基本等級最高再 +50%。'
  },

  /* ---------------- 高階祭司 High Priest（#64）----------------

     官方 4 個，**全部照官方做，沒有一條魔改**——這是六批進階二轉裡唯一一批。
     id 對照：
       HP_MANARECHARGE  魔力減免    → hp_manarecharge
       HP_BASILICA      神聖殿堂    → hp_basilica
       HP_ASSUMPTIO     聖母之祈福  → hp_assumptio
       HP_MEDITATIO     冥想        → hp_meditatio                         */

  // 官方：技能 SP 消耗 −4/8/12/16/20%
  hp_manarecharge: {
    id: 'hp_manarecharge', name: '魔力減免 Mana Recharge', maxLv: 5,
    type: 'passive', passiveStat: 'skillSpCostReduce', element: 'neutral',
    spCost: [0], cooldown: [0],
    mult: [4, 8, 12, 16, 20],
    desc: '被動技能，所有技能的 SP 消耗減少 4%~20%。'
  },

  // 官方：聖屬性魔法傷害 +3~15%、對暗/不死屬性目標的物理傷害 +5~25%，持續 60~180 秒
  hp_basilica: {
    id: 'hp_basilica', name: '神聖殿堂 Basilica', maxLv: 5,
    type: 'buff_basilica', element: 'holy',
    spCost: [40, 50, 60, 70, 80], cooldown: [60, 60, 60, 60, 60],
    mult: [1.03, 1.06, 1.09, 1.12, 1.15],   // 聖屬性魔法傷害
    physPct: [5, 10, 15, 20, 25],           // 對暗／不死屬性目標的物理傷害
    /* 官方寫的是「暗屬性或不死屬性」，但本作沒有任何怪掛得上不死**屬性**
       （undead 只在 ELEMENT_CHART 的防守列出現），所以同時認不死**種族**，
       這一半才真的打得到東西。可遇怪：暗屬性 43 隻、不死種族 31 隻，聯集 74 隻。 */
    targetElements: ['shadow', 'undead'],
    targetRaces: ['undead'],
    duration: [60, 90, 120, 150, 180],
    desc: '聖屬性魔法傷害 +3%~15%，對暗屬性目標與不死種族目標的物理傷害 +5%~25%，持續 60~180 秒。'
  },

  /* 官方：裝備DEF +50~250、受到的治癒恢復量 +2~10%，持續 20~100 秒。
     DEF +250 在本作**不會過強**——減傷公式 (4000+硬防)/(4000+10×硬防) 有邊際遞減，
     Lv99 最佳裝備 +10 精煉的硬防已經是 515（減傷 50.7%），再 +250 只多 8.4 個百分點。
     使用者 2026-08-09 核對官方公式後決定照官方原值。 */
  hp_assumptio: {
    id: 'hp_assumptio', name: '聖母之祈福 Assumptio', maxLv: 5,
    type: 'buff_assumptio', element: 'holy',
    spCost: [20, 30, 40, 50, 60], cooldown: [30, 30, 30, 30, 30],
    mult: [1.02, 1.04, 1.06, 1.08, 1.10],   // 受到的治癒恢復量
    defFlat: [50, 100, 150, 200, 250],
    duration: [20, 40, 60, 80, 100],
    desc: '裝備防禦力 +50~250、受到的治癒恢復量 +2%~10%，持續 20~100 秒。'
  },

  // 官方：最大SP +1~10%、SP 自然恢復 +3~30%、治癒術恢復量 +2~20%
  hp_meditatio: {
    id: 'hp_meditatio', name: '冥想 Meditatio', maxLv: 10,
    type: 'passive', passiveStat: 'meditatio', element: 'neutral',
    spCost: [0], cooldown: [0],
    mult: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],                    // 最大SP +N%
    spRegenPct: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    healPct: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    desc: '被動技能，最大SP +1%~10%、SP 自然恢復 +3%~30%、治癒術恢復量 +2%~20%。'
  },
};
