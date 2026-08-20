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
  spregen: {"id":"spregen","name":"禪心","maxLv":10,"type":"passive","passiveStat":"zenRecovery","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"spPctBonus":[0.2,0.4,0.6,0.8,1,1.2,1.4,1.6,1.8,2],"itemEffectBonus":[10,20,30,40,50,60,70,80,90,100],"desc":"被動技能。每次SP自然恢復時額外恢復 3~30 點，再加上最大SP的 0.2%~2%；SP恢復道具的效果 +10%~100%。（加的是每次的「恢復量」，不是SP上限——官方 MG_SRECOVERY 就是這樣）"},
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
  cartattack: {"id":"cartattack","name":"手推車攻擊","maxLv":1,"isQuest":true,"type":"damage_aoe","alwaysHit":true,"element":"neutral","spCost":[8],"cooldown":[3],"mult":[1.5],"desc":"轉職自動習得，用手推車撞擊敵人與周圍怪物，固定造成ATK150%範圍傷害。"},
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
  teleport: {"id":"teleport","name":"瞬間移動","maxLv":2,"type":"passive","passiveStat":"fleeFlat","spCost":[0],"cooldown":[0],"mult":[5,10],"desc":"被動技能，永久提升迴避+5~+10（依等級）。"},
  warpportal: {"id":"warpportal","name":"傳送之陣","maxLv":4,"type":"stun_field","aoeFromLv":3,"stunSec":1,"spCost":[15,18,21,24],"cooldown":[20,15,15,10],"desc":"Lv1-2對當前目標暈眩1秒，Lv3-4對場上全體怪物暈眩1秒。冷卻時間隨等級縮短（20~10秒）。"},
  ruwach: {"id":"ruwach","name":"光獵","maxLv":1,"type":"magic_aoe","element":"holy","spCost":[10],"cooldown":[20],"mult":[1.45],"bonusHitBuff":[10],"bonusHitDuration":[20],"desc":"召喚聖靈，使自身HIT+10（持續20秒），並對場上所有敵人造成145%聖屬性魔法傷害。"},
  pneuma: {"id":"pneuma","name":"光之障壁","maxLv":1,"type":"buff_def","spCost":[10],"cooldown":[20],"mult":[1.5],"duration":[10],"desc":"創造一道光之障壁，短暫提升防禦力，持續10秒。"},
  divineprotection: {"id":"divineprotection","name":"天使之護","maxLv":10,"type":"passive","passiveStat":"defFlat","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"desc":"被惡魔/不死種族攻擊時，物理防禦力+3~30（依等級）。"},
  cure: {"id":"cure","name":"治療術","maxLv":1,"type":"passive","passiveStat":"partyAutoCure","spCost":[0],"cooldown":[0],"cureTypes":["silence","confusion","blind"],"internalCooldown":[10],"desc":"被動技能，全隊有人陷入沉默／混亂／黑暗時自動解除，冷卻10秒。"},
  angelusbarrier: {"id":"angelusbarrier","name":"天使之障壁","maxLv":10,"type":"buff_angelus","party":true,"spCost":[23,26,29,32,35,38,41,44,47,50],"cooldown":[30,30,30,30,30,30,30,30,30,30],"defPct":[5,10,15,20,25,30,35,40,45,50],"maxHpFlat":[50,100,150,200,250,300,350,400,450,500],"duration":[30,60,90,120,150,180,210,240,270,300],"desc":"使全體的物理防禦力+5%~50%、最大HP+50~500，持續30~300秒（依等級）。"},
  heal: {"id":"heal","name":"治癒術","maxLv":10,"type":"heal","spCost":[12,14,16,18,20,22,24,26,28,30],"cooldown":[4,4,4,4,4,4,4,4,4,4],"mult":[1,1.3,1.6,1.9,2.2,2.5,2.8,3.1,3.4,3.7],"desc":"恢復自身HP。可在自動戰鬥頁面設定依HP%/SP%門檻自動施放。"},
  increaseagi: {"id":"increaseagi","name":"加速術","maxLv":10,"type":"buff_aspd","party":true,"spCost":[18,21,24,27,30,33,36,39,42,45],"hpCost":[15,15,15,15,15,15,15,15,15,15],"cooldown":[25,25,25,25,25,25,25,25,25,25],"mult":[1.01,1.02,1.03,1.04,1.05,1.06,1.07,1.08,1.09,1.1],"agiFlatBonus":[3,4,5,6,7,8,9,10,11,12],"duration":[60,80,100,120,140,160,180,200,220,240],"desc":"消耗15HP，使**全體**AGI+3~12、攻速+1%~10%，持續60~240秒（依等級）。（官方是指定隊員施放，本作沒有指定對象，改成全隊一起吃）"},
  decreaseagi: {"id":"decreaseagi","name":"緩速術","maxLv":10,"type":"passive","passiveStat":"onHitStunProc","spCost":[0],"cooldown":[0],"procChance":[53,56,59,62,65,68,71,74,77,80],"stunSec":0.5,"internalCooldown":[10,9.4,8.9,8.3,7.8,7.2,6.7,6.1,5.6,5],"desc":"被動技能，被攻擊時有53%~80%機率使攻擊者暈眩0.5秒（依等級），冷卻10~5秒。"},
  angelic: {"id":"angelic","name":"天使之擊","maxLv":10,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"desc":"對惡魔/不死種族攻擊時，固定傷害+3~30（依等級），不受DEF削減。"},
  blessing: {"id":"blessing","name":"天使之賜福","maxLv":10,"type":"buff_blessing","party":true,"spCost":[28,32,36,40,44,48,52,56,60,64],"cooldown":[30,30,30,30,30,30,30,30,30,30],"statBonus":[1,2,3,4,5,6,7,8,9,10],"hitBonus":[2,4,6,8,10,12,14,16,18,20],"duration":[60,80,100,120,140,160,180,200,220,240],"desc":"使**全體**STR/INT/DEX各+1~10、HIT+2~20，持續60~240秒（依等級）。（官方是指定隊員施放，本作沒有指定對象，改成全隊一起吃）異常狀態解除（詛咒/石化）暫擱置。"},
  signumcrusis: {"id":"signumcrusis","name":"天使之光","maxLv":10,"type":"debuff_def","spCost":[10,10,10,10,10,10,10,10,10,10],"cooldown":[20,19,18,17,16,14,13,12,11,10],"mult":[1.02,1.04,1.06,1.08,1.1,1.12,1.14,1.16,1.18,1.2],"duration":[10,10,10,10,10,10,10,10,10,10],"desc":"降低敵人防禦力，持續10秒，冷卻隨等級縮短（20~10秒）。"},
  holywater: {"id":"holywater","name":"天使之淚","maxLv":1,"type":"passive","passiveStat":"autoDetox","spCost":[0],"cooldown":[0],"mult":[1],"internalCooldown":[10],"desc":"被動技能，身上有異常狀態時自動解除，冷卻10秒。（遊戲目前玩家唯一會有的異常狀態是中毒）"},
  holylight: {"id":"holylight","name":"神聖之光","maxLv":1,"isQuest":true,"type":"magic","element":"holy","spCost":[15],"cooldown":[3],"mult":[1.25],"desc":"對目標造成125%聖屬性魔法傷害。（官方還會解除目標的霸邪之陣，本作的怪物不會用那招）"},
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
  falcondelivery: {"id":"falcondelivery","name":"獵鷹尋敵","maxLv":4,"type":"passive","passiveStat":"critRate","spCost":[0],"cooldown":[0],"mult":[1,2,3,4],"desc":"被動技能，永久提升暴擊率+1%~4%。"},
  huntingmastery: {"id":"huntingmastery","name":"馴鷹術","maxLv":1,"type":"passive","passiveStat":"huntingMastery","spCost":[0],"cooldown":[0],"mult":[1],"desc":"被動技能，本身無直接效果，需先學習才能點閃電衝擊。"},
  blitzbeat: {"id":"blitzbeat","name":"閃電衝擊","maxLv":5,"type":"damage_aoe","alwaysHit":true,"element":"wind","spCost":[18,18,18,18,18],"cooldown":[3,3,3,3,3],"mult":[1,2,3,4,5],"passiveMult":[0.4,0.8,1.2,1.6,2],"requires":{"skillId":"huntingmastery","level":1},"desc":"主動：召喚獵鷹範圍攻擊，ATK 100%~500%（依等級）。被動：普攻時依LUK機率額外觸發一次獵鷹單體攻擊，ATK最高40%~200%（依等級）。需先學會馴鷹術。"},
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
  maceMastery: {"id":"maceMastery","name":"鈍器使用熟練度","maxLv":10,"type":"passive","passiveStat":"atkFlat","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"critBonus":[1,2,3,4,5,6,7,8,9,10],"requiresWeapon":"mace","desc":"永久提升鈍器攻擊力+3~30、爆擊率+1%~10%（依等級，需裝備鈍器才生效）。"},
  zenrecovery: {"id":"zenrecovery","name":"禪心","maxLv":10,"type":"passive","passiveStat":"zenRecovery","element":"neutral","spCost":[0],"cooldown":[0],"mult":[3,6,9,12,15,18,21,24,27,30],"spPctBonus":[0.2,0.4,0.6,0.8,1,1.2,1.4,1.6,1.8,2],"itemEffectBonus":[10,20,30,40,50,60,70,80,90,100],"desc":"被動技能。每次SP自然恢復時額外恢復 3~30 點，再加上最大SP的 0.2%~2%；SP恢復道具的效果 +10%~100%。（加的是每次的「恢復量」，不是SP上限——官方 MG_SRECOVERY 就是這樣）"},
  sanctuary: {"id":"sanctuary","name":"光耀之堂","maxLv":10,"type":"field_heal","fieldTickIntervalSec":1,"spCost":[15,18,21,24,27,30,33,36,39,42],"cooldown":[20,20,20,20,20,20,20,20,20,20],"healPerTick":[100,200,300,400,500,600,777,777,777,777],"duration":[4,7,10,13,16,19,22,25,28,31],"desc":"展開光耀之堂，使自身每秒恢復100~777點HP（依等級），持續4~31秒。（5秒對不死種族造成減半傷害）"},
  magnificat: {"id":"magnificat","name":"聖母之頌歌","maxLv":1,"type":"buff_sprate","party":true,"spCost":[40],"cooldown":[45],"mult":[2],"duration":[30],"desc":"使全體SP自然恢復速度變為2倍，持續30秒。"},
  gloria: {"id":"gloria","name":"幸運之頌歌","maxLv":5,"type":"buff_lukflat","party":true,"spCost":[20,20,20,20,20],"cooldown":[30,30,30,30,30],"lukBonus":[30,30,30,30,30],"duration":[10,15,20,25,30],"desc":"使全體LUK+30，持續10~30秒（依等級）。"},
  kyrie: {"id":"kyrie","name":"霸邪之陣","maxLv":10,"type":"buff_shield","party":true,"spCost":[20,20,20,20,20,20,20,20,20,20],"cooldown":[15,15,15,15,15,15,15,15,15,15],"shieldCapacityPct":[12,14,16,18,20,22,24,26,28,30],"shieldCharges":[5,6,6,7,7,8,8,9,9,10],"duration":[120,120,120,120,120,120,120,120,120,120],"desc":"為全體設置護盾，耐久度為最大HP的12%~30%，可抵擋5~10次物理傷害，最多持續2分鐘（依等級）。"},
  assumptio: {"id":"assumptio","name":"犧牲祈福","maxLv":3,"type":"passive","passiveStat":"aspdFlat","spCost":[0],"cooldown":[0],"mult":[1,2,3],"desc":"被動技能，永久提升ASPD+1~3（依等級）。"},
  sanctuary_holy: {"id":"sanctuary_holy","name":"聖之祈福","maxLv":5,"type":"buff_elearmor","element":"holy","party":true,"spCost":[20,20,20,20,20],"cooldown":[15,15,15,15,15],"duration":[40,80,120,160,200],"desc":"使全體玩家的防禦屬性變為聖屬性，持續40~200秒（依等級）。"},
  aspersio: {"id":"aspersio","name":"撒水祈福","maxLv":5,"type":"buff_holyweapon","party":true,"spCost":[14,18,22,26,30],"zenyCost":[1500,1500,1500,1500,1500],"cooldown":[15,15,15,15,15],"duration":[60,90,120,150,180],"desc":"消耗1500鋅幣，使全體武器附加聖屬性，持續60~180秒（依等級）。"},
  slowpoison: {"id":"slowpoison","name":"緩毒術","maxLv":4,"type":"buff_ailimmune","ailType":"poison","party":true,"spCost":[6,8,10,12],"cooldown":[10,10,10,10],"duration":[10,20,30,40],"desc":"使全體免疫中毒異常，持續10~40秒（依等級）。"},
  resurrection: {"id":"resurrection","name":"復活術","maxLv":4,"type":"passive","passiveStat":"onDeathRevive1","spCost":[0],"cooldown":[0],"revivePct":[10,30,50,80],"internalCooldown":[120,100,80,60],"reviveSpCost":[60,60,60,60],"desc":"被動技能，全隊有人倒下時自動原地復活並恢復10%~80%HP（依等級），消耗SP60，冷卻120~60秒。"},
  impositio: {"id":"impositio","name":"沉默之術","maxLv":1,"type":"passive","passiveStat":"onAttackSilenceProc","spCost":[0],"cooldown":[0],"procChance":[20],"internalCooldown":[10],"silenceSec":8,"desc":"被動技能，普通攻擊有20%機率使敵人沉默，冷卻10秒。"},
  turnundead: {"id":"turnundead","name":"轉生術","maxLv":10,"type":"magic","element":"holy","spCost":[15,15,15,15,15,17,17,17,17,17],"cooldown":[3,3,3,3,3,3,3,3,3,3],"mult":[1,1.22,1.44,1.67,1.89,2.11,2.33,2.56,2.78,3],"levelScaleMax":100,"intScaleMax":50,"desc":"對目標造成100%~300%聖屬性魔法傷害（依等級），並依基本等級(最高+100%，99級)與INT(最高+50%，INT99)增加傷害。（對不死種族秒殺的部分因遊戲無種族系統，暫不實作）"},
  angelus: {"id":"angelus","name":"天使之怒","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"angelusProc","spCost":[0],"cooldown":[0],"angelusCooldownSec":10,"desc":"被動技能，每10秒下一次攻擊會造成雙倍傷害。"},
  asperio: {"id":"asperio","name":"十字驅魔攻擊","maxLv":10,"type":"field_aoe_magic","element":"holy","fieldTickIntervalSec":3,"spCost":[40,42,44,46,48,50,52,54,56,58],"cooldown":[15,15,15,15,15,15,15,15,15,15],"mult":[1,2,3,4,5,6,7,8,9,10],"duration":[12,12,12,12,12,12,12,12,12,12],"desc":"在原地造成持續範圍聖屬性魔法傷害，每3秒一次，共持續12秒，每次傷害為MATK 100%~1000%（依等級）。"},
  suffragium: {"id":"suffragium","name":"捨身取義","maxLv":1,"isQuest":true,"type":"passive","passiveStat":"onDeathRevive2","spCost":[0],"cooldown":[0],"revivePct":[50],"internalCooldown":[300],"desc":"被動技能，HP歸零時原地復活並恢復50%HP，冷卻300秒（若復活術可用會優先觸發復活術）。"},

  /* ---- 卡片自動念咒／賦予技能需要的技能本體（#22）----
     這幾個官方技能本作原本沒有，所以那批卡片一直卡在「框架好了但沒有技能可放」。
     **刻意不掛在任何職業的技能表下**——只有卡片用得到，玩家學不到也加不了點。
     `castSkill(id, {free:true})` 與 `findSkillForUse()` 都是查 SKILLS，不必進職業樹。

     其中三個現在做得到，是因為需要的東西後來才補上：解除增益要有 `mon.mbuff`（#45）、
     痊癒術要有 `state.playerAil`（#30）、冷笑話要有怪物異常狀態（#29）。
     這些在 #22 寫下時都還不存在。 */
  frostjoke: {"id":"frostjoke","name":"冷笑話","maxLv":5,"type":"ailment_aoe","element":"water","ailment":"freeze","successChance":[15,20,25,30,35],"spCost":[10,10,10,10,10],"cooldown":[10,10,10,10,10],"desc":"講一個冷到結凍的笑話，對全部敵人各有15%~35%機率造成冰凍（依等級）。"},
  impositio_manus: {"id":"impositio_manus","name":"神威祈福","maxLv":5,"type":"buff_atk","party":true,"spCost":[20,20,20,20,20],"cooldown":[30,30,30,30,30],"mult":[1.05,1.075,1.1,1.125,1.15],"duration":[30,38,45,53,60],"desc":"使全體攻擊力+5%~15%，持續30~60秒（依等級）。（官方是固定值 ATK+5×等級，本作的攻擊力buff一律是倍率制，改成等效的百分比）"},
  /* 自動防禦與聖十字審判是十字軍的技能，但 id **沒有 cr_ 前綴**——
     `clock_card` 與 `solace_card` 兩張卡片的 autoSpell 指名這兩個 id，
     改名等於把那兩張卡打斷。既有 id 留著，內容更新成官方數值。 */
  autoguard: {
    id: 'autoguard', name: '自動防禦 Auto Guard', maxLv: 10,
    type: 'buff_block', requiresEquip: 'shield',
    spCost: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
    cooldown: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
    blockChance: [5, 10, 14, 18, 21, 24, 26, 28, 29, 30],
    duration: [300, 300, 300, 300, 300, 300, 300, 300, 300, 300],
    desc: '需裝備盾牌。進入防禦姿態，有 5%~30% 機率完全擋下敵人的物理攻擊，持續 300 秒。'
  },
  /* 官方：消耗當前 HP 20%，3 次聖屬性魔法 AoE，自己也吃一半傷害。
     使用者 2026-08-09 指定做出自傷，但加兩道保險：HP 低於 25% 時放不出來、
     自傷永遠留 1 HP。次數直接乘進倍率（跟重力原野同一套做法）。 */
  grandcross: {
    id: 'grandcross', name: '聖十字審判 Grand Cross', maxLv: 10,
    type: 'magic_aoe', element: 'holy',
    spCost: [37, 44, 51, 58, 65, 72, 78, 86, 93, 100],
    cooldown: [8, 8, 8, 8, 8, 8, 8, 8, 8, 8],
    mult: [4.2, 5.4, 6.6, 7.8, 9.0, 10.2, 11.4, 12.6, 13.8, 15.0],   // 官方 140%~500% × 3 次
    hpCostPct: 20, selfDamagePct: 50, minHpPctToCast: 25,
    desc: '需要 HP 25% 以上才放得出來。消耗當前 HP 的 20%，對全部敵人造成 3 次聖屬性魔法傷害'
        + '（合計 MATK×420%~1500%），自己也會受到一半傷害（不會因此死亡，最低留 1 HP）。'
  },
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

  /* ================= 十字軍（CR_，二轉分支第一個）=================
     官方 12 個技能，本作做 10 個：

       CR_AUTOGUARD      自動防禦      → autoguard（id 見上面的註解）
       CR_SHIELDCHARGE   盾擊          → cr_shieldcharge
       CR_SHIELDBOOMERANG 迴旋盾擊     → cr_shieldboomerang
       CR_DEFENDER       光之盾        → cr_defender
       CR_REFLECTSHIELD  反射盾        → cr_reflectshield
       CR_TRUST          信任          → cr_trust
       CR_HOLYCROSS      聖十字攻擊    → cr_holycross
       CR_GRANDCROSS     聖十字審判    → grandcross（id 見上面的註解）
       CR_PROVIDENCE     神祐之光      → cr_providence
       CR_SPEARQUICKEN   長矛加速術    → cr_spearquicken

       CR_SHRINK         退縮          → cr_shrink（官方 maxLv 0，改成轉職自動獲得的被動）

       CR_DEVOTION       犧牲          → **擱置**。官方是把隊友受到的傷害轉到自己身上，
                                         本作沒有隊伍系統。使用者 2026-08-09 表示之後
                                         有考慮開隊友模式，所以不當永久 N/A，先不做。

     五個盾牌專用技能寫 `requiresEquip: 'shield'`，長矛加速術寫 `requiresWeapon: 'spear'`。 */

  cr_shieldcharge: {
    id: 'cr_shieldcharge', name: '盾擊 Shield Charge', maxLv: 5,
    type: 'damage', element: 'neutral', requiresEquip: 'shield',
    spCost: [10, 10, 10, 10, 10], cooldown: [4, 4, 4, 4, 4],
    mult: [1.2, 1.4, 1.6, 1.8, 2.0],
    inflict: { type: 'stun', chance: [20, 25, 30, 35, 40] },
    desc: '需裝備盾牌。以盾牌重擊目標，造成 ATK 120%~200% 傷害，20%~40% 機率使其暈眩。'
        + '（官方的擊退格數本作沒有位移，不實作）'
  },
  /* 官方：ATK 80%~400%，傷害「會根據盾牌的精煉值和重量而增加」。
     盾重與精煉加進**武器那一桶**，跟螺旋擊刺的武器重量同一條路——
     這樣它才會跟武器 ATK 一起吃屬性、體型與武器浮動。
     重量係數 1.0：ITEMS 的 weight 是官方原始值（顯示值的 10 倍），引擎端會先除以 10。 */
  cr_shieldboomerang: {
    id: 'cr_shieldboomerang', name: '迴旋盾擊 Shield Boomerang', maxLv: 5,
    type: 'damage', element: 'neutral', requiresEquip: 'shield',
    spCost: [12, 12, 12, 12, 12], cooldown: [5, 5, 5, 5, 5],
    mult: [0.8, 1.6, 2.4, 3.2, 4.0],
    shieldWeightMult: 1.0, shieldRefineMult: 4,
    desc: '需裝備盾牌。投擲盾牌造成 ATK 80%~400% 傷害，並依盾牌的重量與精煉值額外增傷。'
  },
  /* 官方是主動 buff、只擋**遠距離**物理（−20%~−80%），代價是攻速 −20%~0%。
     本作怪物沒有遠近之分，照官方數值套到全部傷害會變成全域減傷 80%。
     使用者 2026-08-09 指定：改成**被動**、免傷 10%~40%、攻速懲罰照官方保留、需裝盾，
     並加上 **5 秒內部冷卻**——常駐減傷對場上五隻怪的每一下都生效，等於憑空多一倍有效血量；
     加了冷卻就變成「每 5 秒吃掉最痛的那一下」，跟致命塗毒那批觸發式被動同一種節奏。 */
  cr_defender: {
    id: 'cr_defender', name: '光之盾 Defender', maxLv: 5,
    type: 'passive', passiveStat: 'defenderPassive', requiresEquip: 'shield',
    spCost: [0], cooldown: [0],
    mult: [10, 20, 30, 35, 40],          // 觸發機率 %（成功＝這一擊完全不痛）
    internalCooldown: [5, 5, 5, 5, 5],
    aspdPenalty: [20, 15, 10, 5, 0],     // 攻速 −N%（常駐，不受冷卻影響）
    desc: '被動技能，需裝備盾牌。被攻擊時有 10%~40% 機率完全免除該次傷害（內部冷卻 5 秒），'
        + '攻擊速度則常駐 −20%~0%（等級越高懲罰越小）。'
  },
  /* 官方 maxLv 0（未開放）的開關技能，效果是「自動防禦成功時 50% 機率暈眩對方」。
     使用者 2026-08-09 指定改成**被動、轉職自動獲得**（`autoGrant`）——
     一個 1 秒暈眩不值得花技能點，做成要點的等於做了個沒人點的技能。 */
  cr_shrink: {
    id: 'cr_shrink', name: '退縮 Shrink', maxLv: 1,
    type: 'passive', passiveStat: 'shrinkStun', autoGrant: true,
    spCost: [0], cooldown: [0],
    mult: [50], stunSec: [1],
    desc: '被動技能，轉職時自動獲得。以自動防禦擋下攻擊時，有 50% 機率使對方暈眩 1 秒。'
  },
  cr_reflectshield: {
    id: 'cr_reflectshield', name: '反射盾 Reflect Shield', maxLv: 10,
    type: 'buff_reflect', requiresEquip: 'shield',
    spCost: [35, 40, 45, 50, 55, 60, 65, 70, 75, 80],
    cooldown: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    reflectPct: [13, 16, 19, 22, 25, 28, 31, 34, 37, 40],
    duration: [300, 300, 300, 300, 300, 300, 300, 300, 300, 300],
    desc: '需裝備盾牌。受到近距離物理傷害時，將 13%~40% 反射給對方，持續 300 秒。'
  },
  cr_trust: {
    id: 'cr_trust', name: '信任 Faith', maxLv: 10,
    type: 'passive', passiveStat: 'trustPassive',
    spCost: [0], cooldown: [0],
    mult: [200, 400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000],   // 最大HP 固定值
    holyResist: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    desc: '被動技能，最大HP +200~+2000、受到的聖屬性傷害 −5%~−50%。'
  },
  /* 官方：聖屬性近距離物理 135%~450%，黑暗 3%~30%，「裝備雙手矛時傷害會變成雙倍」。 */
  cr_holycross: {
    id: 'cr_holycross', name: '聖十字攻擊 Holy Cross', maxLv: 10,
    type: 'damage', element: 'holy',
    spCost: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    cooldown: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    mult: [1.35, 1.7, 2.05, 2.4, 2.75, 3.1, 3.45, 3.8, 4.15, 4.5],
    twoHandSpearMult: 2,
    inflict: { type: 'blind', chance: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30] },
    desc: '以聖十字對目標造成聖屬性 ATK 135%~450% 傷害，3%~30% 機率使其黑暗。裝備雙手矛時傷害加倍。'
  },
  /* 官方是對友方單體施放，本作沒有隊友 → 改成自身 buff。
     兩個減傷都用既有的欄位（eleReduce_holy / raceDmgReduce_demon），不另開機制。 */
  cr_providence: {
    id: 'cr_providence', name: '神祐之光 Providence', maxLv: 5,
    type: 'buff_providence', element: 'holy',
    spCost: [30, 30, 30, 30, 30], cooldown: [30, 30, 30, 30, 30],
    reducePct: [5, 10, 15, 20, 25],
    duration: [180, 180, 180, 180, 180],
    desc: '受到的聖屬性傷害與惡魔種族的傷害 −5%~−25%，持續 180 秒。（官方是對隊友施放，本作沒有隊伍，改成自身）'
  },
  cr_spearquicken: {
    id: 'cr_spearquicken', name: '長矛加速術 Spear Quicken', maxLv: 10,
    type: 'buff_spearquicken', requiresWeapon: 'spear',
    spCost: [24, 28, 32, 36, 40, 44, 48, 52, 56, 60],
    cooldown: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    mult: [1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3, 1.3],   // 攻速 +30%（官方各級相同）
    critFlat: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    fleeFlat: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    duration: [30, 60, 90, 120, 150, 180, 210, 240, 270, 300],
    desc: '需裝備矛類武器。攻擊速度 +30%、暴擊率 +3~30、迴避 +2~20，持續 30~300 秒。'
  },

  /* ================= 詩人 BA_ / 舞孃 DC_ / 共用 BD_（#68）=================

     官方每個職業 9 個自己的技能 + 11 個共用的 BD_，兩邊靠性別二選一。

     四個共通的改動（使用者 2026-08-09 指定）：

     1. **隊員增益 → 自身 buff**。官方那批寫的是「自身與周圍 31×31 內隊員」，
        本作單人，效果原封不動套在自己身上。
     2. **範圍弱化技 → 普攻觸發的被動**。冷笑話、驚聲尖叫、不諧和音、醜陋之舞、
        陣痛之聲、眨眼之誘六個，全部改成普攻機率觸發＋內部冷卻。
     3. **互斥組**。官方每個演奏／舞蹈技能都寫「無法與其它演奏技能效果重疊」：
        `exclusiveGroup: 'song'` 同時只能開一個、`'ensemble'` 同時只能開一個，
        但兩組之間不互斥（可以「一個專用技 + 一個合奏」）。
     4. **合奏單人減半**（`soloMult: 0.5`）。官方合奏要 9×9 內有一個異性的詩舞系隊員；
        本作沒有隊伍，所以單人放得出來但只有一半。日後開隊友模式時兩人各放一次
        就是兩份半效果疊起來＝官方完整效果，資料不必改。

     移速一律照既定慣例（騎乘術／月夜貓／手推車加速）改成**生怪加速**。 */

  // ---- 詩人自己的 9 個 ----
  ba_musicallesson: {
    id: 'ba_musicallesson', name: '操控樂器 Musical Lesson', maxLv: 10,
    type: 'passive', passiveStat: 'songMastery', requiresWeapon: 'instrument',
    spCost: [0], cooldown: [0],
    mult: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],                        // 最大SP +N%
    atkFlat: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    aspdPct: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    spawnSpeedPct: [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25],
    desc: '被動技能。最大SP +1%~10%；裝備樂器時 ATK +3~30、攻速 +1%~10%。'
        + '（官方的合奏移速加成，本作沒有移動，改成生怪加速 +2.5%~25%）'
  },
  frostjoke: {
    id: 'frostjoke', name: '冷笑話 Frost Joke', maxLv: 5,
    type: 'passive', passiveStat: 'onAttackAoeAilment', element: 'water',
    spCost: [0], cooldown: [0],
    ailment: 'freeze', mult: [0],
    procChance: [20, 25, 30, 35, 40], internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能。普通攻擊有 20%~40% 機率講一個冷到結凍的笑話，使全體敵人冰凍（內部冷卻 5 秒）。'
  },
  ba_dissonance: {
    id: 'ba_dissonance', name: '不諧和音 Dissonance', maxLv: 5,
    type: 'passive', passiveStat: 'onAttackAoeMagic', element: 'neutral',
    spCost: [0], cooldown: [0],
    mult: [1.1, 1.2, 1.3, 1.4, 1.5],
    procChance: [20, 20, 20, 20, 20], internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能。普通攻擊有 20% 機率對全體敵人發出音波，造成 MATK 110%~150% 的無屬性魔法傷害（內部冷卻 5 秒）。'
        + '（官方限 PVP／攻城戰，本作改成對怪物生效）'
  },
  ba_whistle: {
    id: 'ba_whistle', name: '吹口哨 Whistle', maxLv: 10,
    type: 'buff_song', exclusiveGroup: 'song', requiresWeapon: 'instrument',
    spCost: [22, 24, 26, 28, 30, 32, 34, 36, 38, 40],
    cooldown: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    fleeFlat: [20, 22, 24, 26, 28, 30, 32, 34, 36, 40],
    perfectDodgeFlat: [1, 1, 2, 2, 3, 3, 4, 4, 5, 5],
    duration: [180, 180, 180, 180, 180, 180, 180, 180, 180, 180],
    desc: '需裝備樂器。迴避 +20~40、完全迴避 +1~5，持續 180 秒。（演奏技能同時只能開一個）'
  },
  ba_assassincross: {
    id: 'ba_assassincross', name: '刺客的黃昏 Assassin Cross', maxLv: 10,
    type: 'buff_song', exclusiveGroup: 'song', requiresWeapon: 'instrument',
    spCost: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85],
    cooldown: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    aspdPct: [1, 3, 5, 7, 9, 11, 13, 15, 17, 20],
    duration: [180, 180, 180, 180, 180, 180, 180, 180, 180, 180],
    desc: '需裝備樂器。攻擊速度 +1%~20%，持續 180 秒。（演奏技能同時只能開一個）'
  },
  ba_poembragi: {
    id: 'ba_poembragi', name: '布萊奇之詩 Poem of Bragi', maxLv: 10,
    type: 'buff_song', exclusiveGroup: 'song', requiresWeapon: 'instrument',
    spCost: [65, 70, 75, 80, 85, 90, 95, 100, 105, 110],
    cooldown: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    skillCdPct: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    duration: [180, 180, 180, 180, 180, 180, 180, 180, 180, 180],
    desc: '需裝備樂器。技能冷卻時間 −3%~30%，持續 180 秒。'
        + '（官方是變動詠唱與共同延遲，本作沒有詠唱，照 #55 的慣例折成技能冷卻）'
  },
  ba_appleidun: {
    id: 'ba_appleidun', name: '伊登的蘋果 Apple of Idun', maxLv: 10,
    type: 'buff_song', exclusiveGroup: 'song', requiresWeapon: 'instrument',
    spCost: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85],
    cooldown: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    maxHpPct: [10, 11, 12, 13, 14, 15, 16, 17, 18, 20],
    healRecvPct: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    duration: [180, 180, 180, 180, 180, 180, 180, 180, 180, 180],
    desc: '需裝備樂器。最大HP +10%~20%、受到的HP恢復量 +2%~20%，持續 180 秒。（演奏技能同時只能開一個）'
  },
  ba_musicalstrike: {
    id: 'ba_musicalstrike', name: '樂器攻擊 Musical Strike', maxLv: 5,
    type: 'damage_multi', element: 'neutral', requiresWeapon: 'instrument',
    spCost: [12, 12, 12, 12, 12], cooldown: [2, 2, 2, 2, 2],
    hits: [2, 2, 2, 2, 2],
    mult: [1.5, 1.9, 2.3, 2.7, 3.1],
    consumeAmmo: 1,
    desc: '需裝備樂器，消耗箭矢 1 枝。利用樂器發射箭矢造成 2 次遠距離物理傷害，每次 ATK 150%~310%。'
  },
  ba_pangvoice: {
    id: 'ba_pangvoice', name: '陣痛之聲 Pang Voice', maxLv: 1,
    type: 'passive', passiveStat: 'onAttackDualAilment', autoGrant: true,
    spCost: [0], cooldown: [0], mult: [0],
    procChance: [20], internalCooldown: [0],
    ailments: [{ type: 'confusion', chance: 50 }, { type: 'bleed', chance: 50 }],
    desc: '被動技能，轉職時自動獲得。普通攻擊有 20% 機率大吼，各 50% 機率使目標混亂與出血。'
  },

  // ---- 舞孃自己的 9 個 ----
  dc_dancinglesson: {
    id: 'dc_dancinglesson', name: '練習舞蹈 Dancing Lesson', maxLv: 10,
    type: 'passive', passiveStat: 'songMastery', requiresWeapon: 'whip',
    spCost: [0], cooldown: [0],
    mult: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],                        // 最大SP +N%
    atkFlat: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    critFlat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    spawnSpeedPct: [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25],
    desc: '被動技能。最大SP +1%~10%；裝備鞭子時 ATK +3~30、暴擊率 +1~10。'
        + '（官方的合奏移速加成，本作沒有移動，改成生怪加速 +2.5%~25%）'
  },
  dc_scream: {
    id: 'dc_scream', name: '驚聲尖叫 Scream', maxLv: 5,
    type: 'passive', passiveStat: 'onAttackAoeAilment', element: 'neutral',
    spCost: [0], cooldown: [0],
    ailment: 'stun', ailSec: [0.5, 0.5, 0.5, 0.5, 0.5], mult: [0],
    procChance: [20, 25, 30, 35, 40], internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能。普通攻擊有 20%~40% 機率尖叫，使全體敵人暈眩 0.5 秒（內部冷卻 5 秒）。'
  },
  dc_uglydance: {
    id: 'dc_uglydance', name: '醜陋之舞 Ugly Dance', maxLv: 5,
    type: 'passive', passiveStat: 'onAttackAoeAilment', element: 'neutral',
    spCost: [0], cooldown: [0],
    ailment: 'stun', ailSec: [1, 1, 1, 1, 1], mult: [0],
    procChance: [20, 20, 20, 20, 20], internalCooldown: [10, 9, 8, 7, 5],
    desc: '被動技能。攻擊時有 20% 機率使全體敵人暈眩 1 秒（內部冷卻 10~5 秒，等級越高越短）。'
        + '（官方是「虛耗目標 SP」，怪物沒有 SP，改成控場）'
  },
  dc_humming: {
    id: 'dc_humming', name: '哼唱之音 Humming', maxLv: 10,
    type: 'buff_song', exclusiveGroup: 'song', requiresWeapon: 'whip',
    spCost: [33, 36, 39, 42, 45, 48, 51, 54, 57, 60],
    cooldown: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    hitFlat: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40],
    duration: [180, 180, 180, 180, 180, 180, 180, 180, 180, 180],
    desc: '需裝備鞭子。命中 +4~40，持續 180 秒。（舞蹈技能同時只能開一個）'
  },
  dc_dontforgetme: {
    id: 'dc_dontforgetme', name: '勿忘我 Don\'t Forget Me', maxLv: 10,
    type: 'debuff_aspd_aoe', exclusiveGroup: 'song', requiresWeapon: 'whip',
    spCost: [38, 41, 44, 47, 50, 53, 56, 59, 62, 65],
    cooldown: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15],
    aspdCutPct: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    duration: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
    desc: '需裝備鞭子。場上敵人的攻擊速度 −3%~30%，持續 60 秒；期間新出現的敵人也會被拖慢。'
        + '（官方只對敵方玩家有效，本作改成對怪物）'
  },
  dc_fortunekiss: {
    id: 'dc_fortunekiss', name: '女神之吻 Fortune Kiss', maxLv: 10,
    type: 'buff_song', exclusiveGroup: 'song', requiresWeapon: 'whip',
    spCost: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85],
    cooldown: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    critFlat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    critDmgPct: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    duration: [180, 180, 180, 180, 180, 180, 180, 180, 180, 180],
    desc: '需裝備鞭子。暴擊率 +1~10、暴擊傷害 +2%~20%，持續 180 秒。（舞蹈技能同時只能開一個）'
  },
  dc_serviceforyou: {
    id: 'dc_serviceforyou', name: '為您服務 Service For You', maxLv: 10,
    type: 'buff_song', exclusiveGroup: 'song', requiresWeapon: 'whip',
    spCost: [60, 63, 66, 69, 72, 75, 78, 81, 84, 87],
    cooldown: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    maxSpPct: [10, 11, 12, 13, 14, 15, 16, 17, 18, 20],
    spCostCutPct: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    duration: [180, 180, 180, 180, 180, 180, 180, 180, 180, 180],
    desc: '需裝備鞭子。最大SP +10%~20%、技能SP消耗 −6%~15%，持續 180 秒。（舞蹈技能同時只能開一個）'
  },
  dc_throwarrow: {
    id: 'dc_throwarrow', name: '纏箭投擲 Throw Arrow', maxLv: 5,
    type: 'damage_multi', element: 'neutral', requiresWeapon: 'whip',
    spCost: [12, 12, 12, 12, 12], cooldown: [2, 2, 2, 2, 2],
    hits: [2, 2, 2, 2, 2],
    mult: [1.5, 1.9, 2.3, 2.7, 3.1],
    consumeAmmo: 1,
    desc: '需裝備鞭子，消耗箭矢 1 枝。以鞭子纏住箭矢投擲，造成 2 次遠距離物理傷害，每次 ATK 150%~310%。'
  },
  dc_winkcharm: {
    id: 'dc_winkcharm', name: '眨眼之誘 Wink of Charm', maxLv: 1,
    type: 'passive', passiveStat: 'onAttackDualAilment', autoGrant: true,
    spCost: [0], cooldown: [0], mult: [0],
    procChance: [20], internalCooldown: [0],
    ailments: [{ type: 'confusion', chance: 50 }, { type: 'bleed', chance: 50 }],
    desc: '被動技能，轉職時自動獲得。普通攻擊有 20% 機率放電，各 50% 機率使目標混亂與出血。'
  },

  // ---- 詩人與舞孃共用的 BD_ ----
  bd_adaptation: {
    id: 'bd_adaptation', name: '臨機應變 Adaptation', maxLv: 1,
    type: 'buff_song', exclusiveGroup: 'adapt',
    spCost: [10], cooldown: [10],
    spCostCutPct: [20], duration: [180],
    desc: '技能SP消耗 −20%，持續 180 秒。（不佔演奏／合奏的名額）'
  },
  bd_encore: {
    id: 'bd_encore', name: '安可 Encore', maxLv: 1,
    type: 'encore',
    spCost: [1], cooldown: [10],
    desc: '再放一次上一個演奏／舞蹈／合奏技能，只花該技能一半的 SP。'
  },
  bd_lullaby: {
    id: 'bd_lullaby', name: '搖籃曲 Lullaby', maxLv: 1,
    type: 'ailment_aoe', element: 'neutral', exclusiveGroup: 'ensemble',
    ailment: 'sleep', successChance: [25],
    spCost: [40], cooldown: [20],
    desc: '使全體敵人各有 25% 機率陷入睡眠。（合奏技能，單人只有一半效果——官方是 50%）'
  },
  bd_intoabyss: {
    id: 'bd_intoabyss', name: '觸媒之所 Into the Abyss', maxLv: 1,
    type: 'buff_ensemble', exclusiveGroup: 'ensemble', soloMult: 0.5,
    spCost: [70], cooldown: [15],
    gemFreeChance: [100], duration: [180],
    desc: '使用魔力礦石的技能有機率不消耗礦石，持續 180 秒。'
        + '（官方是「消耗量 −1」，礦石本來就只吃 1 個，單人減半改成 50% 機率不消耗）'
  },
  bd_rokisweil: {
    id: 'bd_rokisweil', name: '洛奇的悲鳴 Loki\'s Veil', maxLv: 1,
    type: 'ailment_aoe', element: 'neutral', exclusiveGroup: 'ensemble',
    ailment: 'silence', successChance: [50],
    spCost: [180], cooldown: [30],
    desc: '使全體敵人各有 50% 機率沉默，無法使用技能。（合奏技能，單人只有一半效果——官方是必定成功）'
  },
  bd_eternalchaos: {
    id: 'bd_eternalchaos', name: '永遠的混沌 Eternal Chaos', maxLv: 1,
    type: 'debuff_def_aoe', element: 'neutral', exclusiveGroup: 'ensemble',
    spCost: [120], cooldown: [30],
    mult: [0.5], duration: [60],
    desc: '使全體敵人的物理防禦力 −50%，持續 60 秒。（合奏技能，單人只有一半效果——官方是直接歸零）'
  },
  bd_siegfried: {
    id: 'bd_siegfried', name: '不死神齊格弗里德 Siegfried', maxLv: 5,
    type: 'buff_ensemble', exclusiveGroup: 'ensemble', soloMult: 0.5,
    spCost: [40, 44, 48, 52, 56], cooldown: [15, 15, 15, 15, 15],
    eleResistPct: [3, 6, 9, 12, 15],
    ailResistPct: [5, 10, 15, 20, 25],
    duration: [180, 180, 180, 180, 180],
    desc: '受到的地／水／火／風屬性傷害減少、異常狀態抗性上升，持續 180 秒。（合奏技能，單人只有一半效果）'
  },
  bd_richmankim: {
    id: 'bd_richmankim', name: '經驗值倍增 Mental Sensing', maxLv: 5,
    type: 'buff_ensemble', exclusiveGroup: 'ensemble', soloMult: 0.5,
    spCost: [62, 68, 74, 80, 86], cooldown: [15, 15, 15, 15, 15],
    expPct: [20, 30, 40, 50, 60],
    duration: [180, 180, 180, 180, 180],
    desc: '打怪獲得的經驗值增加，持續 180 秒。（合奏技能，單人只有一半效果——官方是 +20%~60%）'
  },
  bd_drumbattlefield: {
    id: 'bd_drumbattlefield', name: '戰鼓震天 Battle Theme', maxLv: 5,
    type: 'buff_ensemble', exclusiveGroup: 'ensemble', soloMult: 0.5,
    spCost: [50, 54, 58, 62, 66], cooldown: [15, 15, 15, 15, 15],
    atkFlat: [20, 25, 30, 35, 40],
    defFlat: [15, 30, 45, 60, 75],
    duration: [180, 180, 180, 180, 180],
    desc: 'ATK 與 DEF 上升，持續 180 秒。（合奏技能，單人只有一半效果——官方是 ATK +20~40、DEF +15~75）'
  },
  bd_ringnibelungen: {
    id: 'bd_ringnibelungen', name: '尼貝隆根之戒指 Ring of Nibelungen', maxLv: 5,
    type: 'buff_ensemble', exclusiveGroup: 'ensemble', soloMult: 0.5,
    spCost: [64, 60, 56, 52, 48], cooldown: [15, 15, 15, 15, 15],
    atkFlat: [10, 14, 18, 22, 26],
    critFlat: [4, 6, 8, 10, 12],
    hitFlat: [10, 14, 18, 22, 26],
    duration: [60, 60, 60, 60, 60],
    desc: 'ATK、暴擊率與命中同時上升，持續 60 秒。'
        + '（官方是「隨機獲得一種強化效果」，本作把常見的三種一起給但各只有一部分；合奏技能，單人只有一半效果）'
  },

  /* ================= 流氓 RG_（#69）=================

     官方 17 個技能，本作做 13 個。使用者 2026-08-10 指定的大方向是
     **把九個主動技全部改成普攻觸發的被動**（偷錢、卸除×4、潛擊、脅持、緊密的約束），
     各自帶內部冷卻——流氓在放置遊戲裡本來就是「一直普攻、時不時偷一手」的節奏。

       RG_SNATCHER      強奪        → rg_snatcher（併進既有的偷竊機率）
       RG_STEALCOIN     偷錢        → rg_stealcoin（被動化）
       RG_BACKSTAP      背刺        → rg_backstap（唯一保留成主動的攻擊技）
       RG_TUNNELDRIVE   潛遁        → rg_tunneldrive（移速做不了 → 暴擊 +5%）
       RG_RAID          潛擊        → rg_raid（被動化，前置＝潛遁）
       RG_INTIMIDATE    脅持        → rg_intimidate（位移做不了，只留傷害）
       RG_PLAGIARISM    抄襲        → rg_plagiarism（改成自己挑一個攻擊技能）
       RG_STRIP*        卸除四連    → rg_striphelm / rg_stripshield / rg_striparmor / rg_stripweapon
       RG_COMPULSION    強制減價    → rg_compulsion
       RG_CLOSECONFINE  緊密的約束  → rg_closeconfine（官方 maxLv 0，轉職自動獲得）

       RG_GANGSTER      流氓天國    → **擱置**。使用者指定「隊伍裡有其他流氓時偷竊／偷錢機率各 +10%」，
                                      本作還沒有隊伍系統，跟十字軍的犧牲同一批等隊友模式
       RG_CLEANER / RG_FLAGGRAFFITI / RG_GRAFFITI → 刪除（公會旗幟，官方自己標「效果並未開放」） */

  rg_snatcher: {
    id: 'rg_snatcher', name: '強奪 Snatcher', maxLv: 10,
    type: 'passive', passiveStat: 'snatcher',
    spCost: [0], cooldown: [0],
    mult: [7, 8, 10, 11, 13, 14, 16, 17, 19, 20],
    desc: '被動技能。偷竊的發動機率 +7%~20%。'
  },
  /* 官方成功率只有 1%~10%，而且看 DEX/LUK 與等級差。
     使用者 2026-08-10 指定：DEX 99 時再 +20%、LUK 99 時再 +10%（線性換算），
     偷到的錢是「打死這隻怪會拿到的金額」的 10%，CD 5 秒。 */
  rg_stealcoin: {
    id: 'rg_stealcoin', name: '偷錢 Steal Coin', maxLv: 10,
    type: 'passive', passiveStat: 'stealCoin',
    spCost: [0], cooldown: [0],
    mult: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    dexMaxBonus: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    lukMaxBonus: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    stealPct: 10, internalCooldown: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    desc: '被動技能。普通攻擊有 1%~10% 機率偷錢（DEX 99 時再 +20%、LUK 99 時再 +10%），'
        + '偷到的金額是擊殺該怪獎勵的 10%（內部冷卻 5 秒）。'
  },
  rg_backstap: {
    id: 'rg_backstap', name: '背刺 Back Stab', maxLv: 10,
    type: 'damage', element: 'neutral',
    spCost: [16, 16, 16, 16, 16, 16, 16, 16, 16, 16],
    cooldown: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    mult: [3.4, 3.8, 4.2, 4.6, 5.0, 5.4, 5.8, 6.2, 6.6, 7.0],
    hitBonusOnCast: [4, 8, 12, 16, 20, 24, 28, 32, 36, 40],
    daggerMult: 2, bowMult: 0.5,
    desc: '繞到目標背後造成 ATK 340%~700% 傷害，這一擊的命中 +4~40。'
        + '裝備短劍時傷害加倍、裝備弓時傷害減半（官方規則）。'
  },
  rg_tunneldrive: {
    id: 'rg_tunneldrive', name: '潛遁 Tunnel Drive', maxLv: 1,
    type: 'passive', passiveStat: 'critPct',
    spCost: [0], cooldown: [0],
    mult: [5],
    desc: '被動技能。暴擊率 +5%。（官方是「隱匿狀態下可移動」，本作沒有移動，改成暴擊加成）'
  },
  rg_raid: {
    id: 'rg_raid', name: '潛擊 Raid', maxLv: 5,
    type: 'passive', passiveStat: 'raidProc', element: 'neutral',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'rg_tunneldrive', level: 1 },
    mult: [2, 3.5, 5, 6.5, 8],
    procChance: [20, 20, 20, 20, 20],
    ailChance: [13, 16, 19, 22, 25],
    dmgTakenPct: 30, boostSec: 10,
    internalCooldown: [10, 10, 10, 10, 10],
    desc: '被動技能，需先學會潛遁。普通攻擊有 20% 機率對全體敵人造成 ATK 200%~800% 傷害，'
        + '13%~25% 機率使其暈眩或黑暗，被打中的目標 10 秒內受到的傷害 +30%（內部冷卻 10 秒）。'
  },
  rg_intimidate: {
    id: 'rg_intimidate', name: '脅持 Intimidate', maxLv: 5,
    type: 'passive', passiveStat: 'intimidateProc', element: 'neutral',
    spCost: [0], cooldown: [0],
    mult: [1.3, 1.6, 1.9, 2.2, 2.5],
    procChance: [20, 20, 20, 20, 20],
    internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能。普通攻擊有 20% 機率追加一次 ATK 130%~250% 的傷害（內部冷卻 5 秒）。'
        + '（官方會把自己與目標一起傳送走，本作沒有位移，只保留傷害）'
  },
  /* 官方是「記住最後一個打到你的技能」。使用者 2026-08-10 改成
     **自己從全技能庫的攻擊技能裡挑一個**，等級上限就是抄襲的等級。 */
  rg_plagiarism: {
    id: 'rg_plagiarism', name: '抄襲 Plagiarism', maxLv: 10,
    type: 'passive', passiveStat: 'plagiarism',
    spCost: [0], cooldown: [0],
    mult: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],       // 可記住的技能等級
    aspdPct: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    desc: '被動技能。攻擊速度 +1%~10%，並可從所有攻擊技能中記住一個來使用，'
        + '能用的等級不會超過抄襲本身的等級（Lv1~10）。'
  },
  /* 卸除四連。官方對玩家是剝除裝備（本作永久 N/A），對怪物是素質下降；
     使用者 2026-08-10 指定的對應與機率如下，四個都是普攻 10%~30% 觸發的被動。
     四個各佔一格，所以會疊在一起（頭盔的 ATK 那條也能跟卸除武器疊）。 */
  rg_striphelm: {
    id: 'rg_striphelm', name: '卸除頭盔 Strip Helm', maxLv: 5,
    type: 'passive', passiveStat: 'stripProc',
    spCost: [0], cooldown: [0],
    mult: [10, 15, 20, 25, 30],
    stripKind: 'matk', stripMult: [0.75, 0.75, 0.75, 0.75, 0.75], stripFallbackMult: 0.9,
    stripLabel: '魔法攻擊力', stripDuration: [75, 90, 105, 120, 135],
    internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能。普通攻擊有 10%~30% 機率使目標的 MATK −25%（沒有 MATK 的怪改為 ATK −10%，'
        + '可與卸除武器疊加），持續 75~135 秒（內部冷卻 5 秒）。'
  },
  rg_stripshield: {
    id: 'rg_stripshield', name: '卸除盾牌 Strip Shield', maxLv: 5,
    type: 'passive', passiveStat: 'stripProc',
    spCost: [0], cooldown: [0],
    mult: [10, 15, 20, 25, 30],
    stripKind: 'def', stripMult: [0.85, 0.85, 0.85, 0.85, 0.85],
    stripLabel: '防禦力', stripDuration: [75, 90, 105, 120, 135],
    internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能。普通攻擊有 10%~30% 機率使目標的防禦力 −15%，持續 75~135 秒（內部冷卻 5 秒）。'
  },
  rg_striparmor: {
    id: 'rg_striparmor', name: '卸除鎧甲 Strip Armor', maxLv: 5,
    type: 'passive', passiveStat: 'stripProc',
    spCost: [0], cooldown: [0],
    mult: [10, 15, 20, 25, 30],
    stripKind: 'def', stripMult: [0.9, 0.9, 0.9, 0.9, 0.9],
    stripLabel: '防禦力', stripDuration: [75, 90, 105, 120, 135],
    internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能。普通攻擊有 10%~30% 機率使目標的防禦力 −10%（可與卸除盾牌疊加），'
        + '持續 75~135 秒（內部冷卻 5 秒）。（官方削的是 VIT，本作怪物沒有 VIT，改為防禦力）'
  },
  rg_stripweapon: {
    id: 'rg_stripweapon', name: '卸除武器 Strip Weapon', maxLv: 5,
    type: 'passive', passiveStat: 'stripProc',
    spCost: [0], cooldown: [0],
    mult: [10, 15, 20, 25, 30],
    stripKind: 'atk', stripMult: [0.75, 0.75, 0.75, 0.75, 0.75],
    stripLabel: '攻擊力', stripDuration: [75, 90, 105, 120, 135],
    internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能。普通攻擊有 10%~30% 機率使目標的攻擊力 −25%，持續 75~135 秒（內部冷卻 5 秒）。'
  },
  rg_compulsion: {
    id: 'rg_compulsion', name: '強制減價 Compulsion Discount', maxLv: 5,
    type: 'passive', passiveStat: 'shopDiscount',
    spCost: [0], cooldown: [0],
    mult: [9, 13, 17, 21, 25],
    desc: '被動技能。在 NPC 商店購買物品的價格 −9%~25%。'
  },
  rg_closeconfine: {
    id: 'rg_closeconfine', name: '緊密的約束 Close Confine', maxLv: 1,
    type: 'passive', passiveStat: 'closeConfineProc', autoGrant: true,
    spCost: [0], cooldown: [0], mult: [0],
    procChance: [5], enemyFleeCut: [20], selfFlee: [10],
    duration: [10], internalCooldown: [10],
    desc: '被動技能，轉職時自動獲得。普通攻擊有 5% 機率纏住目標：'
        + '目標迴避 −20、自身迴避 +10，持續 10 秒（內部冷卻 10 秒）。'
  },

  /* ================= 武僧 MO_（#70）=================

     官方 17 個技能**全部做出來**，一個都沒刪——連官方標 maxLv 0 的發勁與振氣注入都在。
     使用者 2026-08-10 指定的大方向跟流氓同一路：**主動技幾乎全部改成被動**，
     由氣球體與連段串起來，玩家只要站著普攻，整套會自己跑完。

     ---- 新機制一：氣球體 ----
     `state.spirits`（現有顆數）與 `state.spiritsMax`（＝蓄氣等級，1~5）。
     蓄氣從主動改成被動：每 5 秒自動補 1 顆到上限。消耗它的有五個技能：
       真劍百破道 1 顆、猛龍誇強 1 顆、爆氣 5 顆、金剛不壞 5 顆、阿修羅霸凰拳 5 顆
     每顆常駐 ATK +3（官方數字），但這 15 點不是重點——氣球體的定位是**技能燃料**。

     ---- 新機制二：連段 ----
     官方要在延遲窗內手動接三次，放置遊戲沒有這個操作空間，所以做成**自動串接**：

       普攻 ──30%──> 六合拳 ──50%──> 連環全身掌 ──30%──> 猛龍誇強 ──20%──> 阿修羅霸凰拳
                                                                      （需爆氣狀態）

     點越多級串越長，不需要任何新 UI。整條鏈寫在 engine.js 的 tryMonkCombo()。

     **猛龍誇強接上阿修羅時，兩者共用同一份氣球體消耗**（合計 5 顆）。
     不這樣寫的話會死鎖：上限就是 5 顆，猛龍先扣掉 1 顆之後永遠湊不滿阿修羅要的 5 顆。

     ---- 官方對照 ----
       MO_IRONHAND        鐵沙掌          → mo_ironhand（空手／拳套限定的 ATK）
       MO_CALLSPIRITS     蓄氣            → mo_callspirits（被動化：自動補球）
       MO_ABSORBSPIRITS   吸氣            → mo_absorbspirits（被動化：普攻回 SP）
       MO_EXPLOSIONSPIRITS 爆氣           → mo_explosionspirits（被動化：滿球自動啟動）
       MO_DODGE           移花接木        → mo_dodge
       MO_BLADESTOP       真劍百破道      → mo_bladestop（定身做不了 → 改成開一個增傷視窗）
       MO_SPIRITSRECOVERY 運氣調息        → mo_spiritsrecovery（本作沒有坐下 → 常駐回復）
       MO_TRIPLEATTACK    六合拳          → mo_tripleattack（連段起點）
       MO_CHAINCOMBO      連環全身掌      → mo_chaincombo（被動化：接在六合拳後）
       MO_COMBOFINISH     猛龍誇強        → mo_combofinish（被動化：接在連環後）
       MO_STEELBODY       金剛不壞        → mo_steelbody（被動化：爆氣中滿球自動啟動）
       MO_INVESTIGATE     浸透勁          → mo_investigate（被動化：真劍視窗內普攻觸發）
       MO_FINGEROFFENSIVE 彈指神通        → mo_fingeroffensive（同上）
       MO_EXTREMITYFIST   阿修羅霸凰拳    → mo_extremityfist（被動化：連段終點）
       MO_BODYRELOCATION  弓身彈影        → mo_bodyrelocation（位移做不了 → 比照騎乘術的生怪加速）
       MO_BALKYOUNG       發勁            → mo_balkyoung（官方 maxLv 0；轉職自動獲得）
       MO_KITRANSLATION   振氣注入        → mo_kitranslation（官方 maxLv 0；**要有隊友才有作用**） */

  mo_ironhand: {
    id: 'mo_ironhand', name: '鐵沙掌 Iron Hand', maxLv: 10,
    type: 'passive', passiveStat: 'atkFlat', requiresWeapon: 'barefist',
    spCost: [0], cooldown: [0],
    mult: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    desc: '被動技能。以空手或拳套攻擊時 ATK +3~30。'
  },
  /* 蓄氣：官方是主動技，一次召一顆、每顆 ATK +3、持續 10 分鐘。
     使用者 2026-08-10 指定改成被動自動補球——放置遊戲不該要人一直點。
     技能等級 = 氣球體上限，這是整個武僧最重要的一格：五顆才開得了爆氣。 */
  mo_callspirits: {
    id: 'mo_callspirits', name: '蓄氣 Call Spirits', maxLv: 5,
    type: 'passive', passiveStat: 'callSpirits',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_ironhand', level: 2 },
    mult: [1, 2, 3, 4, 5],
    atkPerSphere: 3, refillSec: 5,
    desc: '被動技能。氣球體上限 1~5 顆，每 5 秒自動補 1 顆，每顆 ATK +3。'
        + '（官方是主動召喚，本作改成自動補充；氣球體是爆氣、金剛不壞、阿修羅霸凰拳等技能的燃料）'
  },
  /* 吸氣：官方吸的是「目標身上的氣球體」，只有對玩家才有東西可吸；
     對怪那半官方本來就是 20% 機率依等級回 SP，所以只留得下這一半。 */
  mo_absorbspirits: {
    id: 'mo_absorbspirits', name: '吸氣 Absorb Spirits', maxLv: 1,
    type: 'passive', passiveStat: 'absorbSpirits',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_callspirits', level: 5 },
    mult: [20], spGain: [5], internalCooldown: [3],
    desc: '被動技能。普通攻擊有 20% 機率回復 5 SP（內部冷卻 3 秒）。'
  },
  /* 爆氣：官方要手動引爆 5 顆氣球體。改成**滿球自動啟動**，
     所以它同時也是阿修羅霸凰拳的開關——想放阿修羅就得先讓球滿一次。 */
  mo_explosionspirits: {
    id: 'mo_explosionspirits', name: '爆氣 Explosion Spirits', maxLv: 5,
    type: 'passive', passiveStat: 'explosionSpirits',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_absorbspirits', level: 1 },
    mult: [10, 12.5, 15, 17.5, 20],
    spiritCost: 5, duration: [180, 180, 180, 180, 180], spRegenPct: -50,
    desc: '被動技能。氣球體滿 5 顆時自動消耗全部 5 顆進入爆氣狀態：'
        + '暴擊率 +10~20，持續 180 秒，期間 SP 自然回復 −50%。'
        + '（阿修羅霸凰拳與金剛不壞都必須在爆氣狀態下才會發動）'
  },
  mo_dodge: {
    id: 'mo_dodge', name: '移花接木 Dodge', maxLv: 10,
    type: 'passive', passiveStat: 'fleeFlat',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_ironhand', level: 5 },
    mult: [1, 3, 4, 6, 7, 9, 10, 12, 13, 15],
    desc: '被動技能。迴避 +1~15。'
  },
  /* 真劍百破道：官方是「抓住對方，雙方都動不了 10 秒，期間彈指神通／浸透勁 +50%」。
     本作沒有「停止攻擊」這個狀態，把它做成**一個 10 秒的視窗**：
     消耗 1 顆氣球體開啟，期間浸透勁與彈指神通才會發動、而且傷害 ×1.5。
     等級拉的是內部冷卻（20→12 秒），也就是視窗的覆蓋率。 */
  mo_bladestop: {
    id: 'mo_bladestop', name: '真劍百破道 Blade Stop', maxLv: 5,
    type: 'passive', passiveStat: 'bladeStop',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_dodge', level: 5 },
    mult: [50, 50, 50, 50, 50],
    spiritCost: 1, duration: [10, 10, 10, 10, 10],
    internalCooldown: [20, 18, 16, 14, 12],
    desc: '被動技能。普通攻擊時消耗 1 顆氣球體進入「真劍」狀態，持續 10 秒'
        + '（內部冷卻 20→12 秒）。期間浸透勁與彈指神通才會發動，且傷害 +50%。'
  },
  /* 運氣調息：官方是「坐著時每 10 秒回復」，本作沒有坐下的動作，改成常駐加成。
     數字併進自然回復的每 tick 量（跟禪心同一個位置），所以不會另開一條回血心跳。 */
  mo_spiritsrecovery: {
    id: 'mo_spiritsrecovery', name: '運氣調息 Spiritual Cadence', maxLv: 5,
    type: 'passive', passiveStat: 'spiritsRecovery',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_bladestop', level: 2 },
    mult: [0],
    hpFlat: [4, 8, 12, 16, 20], hpPct: [0.2, 0.4, 0.6, 0.8, 1.0],
    spFlat: [2, 4, 6, 8, 10], spPct: [0.2, 0.4, 0.6, 0.8, 1.0],
    desc: '被動技能。自然回復量增加：HP +4~20 與最大HP 0.2%~1.0%、'
        + 'SP +2~10 與最大SP 0.2%~1.0%。（官方限定坐著時，本作沒有坐下 → 改成常駐）'
  },
  mo_tripleattack: {
    id: 'mo_tripleattack', name: '六合拳 Triple Attack', maxLv: 10,
    type: 'passive', passiveStat: 'tripleAttack', element: 'neutral',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_dodge', level: 5 },
    mult: [1.2, 1.4, 1.6, 1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0],
    procChance: [30, 30, 30, 30, 30, 30, 30, 30, 30, 30], hits: 3,
    desc: '被動技能。近戰普通攻擊有 30% 機率追加 3 連擊，合計 ATK 120%~300%。'
        + '（連段的起點：觸發後有機會接上連環全身掌）'
  },
  mo_chaincombo: {
    id: 'mo_chaincombo', name: '連環全身掌 Chain Combo', maxLv: 5,
    type: 'passive', passiveStat: 'chainCombo', element: 'neutral',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_tripleattack', level: 5 },
    mult: [3, 3.5, 4, 4.5, 5],
    procChance: [50, 50, 50, 50, 50], hits: 4, knuckleHits: 6, knuckleMult: 2,
    desc: '被動技能。六合拳觸發後有 50% 機率接上 4 連擊，合計 ATK 300%~500%。'
        + '裝備拳套時變成 6 連擊且傷害加倍（官方規則）。'
  },
  mo_combofinish: {
    id: 'mo_combofinish', name: '猛龍誇強 Combo Finish', maxLv: 5,
    type: 'passive', passiveStat: 'comboFinish', element: 'neutral',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_chaincombo', level: 3 },
    mult: [6, 7.5, 9, 10.5, 12],
    procChance: [30, 30, 30, 30, 30], spiritCost: 1, strScale: 200,
    desc: '被動技能。連環全身掌觸發後有 30% 機率接上，消耗 1 顆氣球體，'
        + 'ATK 600%~1200% 並隨 STR 再上升（STR 99 時約 +50%）。'
        + '（連段的倒數第二段：爆氣狀態下有機會再接上阿修羅霸凰拳）'
  },
  /* 金剛不壞：官方是消 5 球換「受傷 −90%，但期間不能用主動技、移速攻速 −25%」。
     使用者 2026-08-10 指定改成被動、減傷砍到 10~20%、持續 10~30 秒，缺點不留。
     內部冷卻 60 秒是本作自訂的：不設的話它會把每一輪補滿的 5 顆球都吃掉，
     阿修羅霸凰拳永遠等不到球。 */
  mo_steelbody: {
    id: 'mo_steelbody', name: '金剛不壞 Steel Body', maxLv: 5,
    type: 'passive', passiveStat: 'steelBody',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_combofinish', level: 3 },
    mult: [10, 12.5, 15, 17.5, 20],
    spiritCost: 5, duration: [10, 15, 20, 25, 30],
    internalCooldown: [60, 60, 60, 60, 60],
    desc: '被動技能。爆氣狀態下氣球體滿 5 顆時自動消耗全部 5 顆：'
        + '受到的傷害 −10%~20%，持續 10~30 秒（內部冷卻 60 秒）。'
  },
  /* 浸透勁：官方無視迴避、傷害隨目標的裝備防禦上升。兩件事都照做——
     所以它是專門用來拆高防怪的那一招，對零防的怪反而是全隊最弱的倍率。 */
  mo_investigate: {
    id: 'mo_investigate', name: '浸透勁 Investigate', maxLv: 5,
    type: 'passive', passiveStat: 'investigate', element: 'neutral',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_callspirits', level: 5 },
    mult: [1, 2, 3, 4, 5],
    procChance: [20, 20, 20, 20, 20], internalCooldown: [5, 5, 5, 5, 5],
    defScale: 100,
    desc: '被動技能。真劍狀態中，普通攻擊有 20% 機率發動（內部冷卻 5 秒）：'
        + 'ATK 100%~500%，無視防禦，且傷害隨目標防禦上升。'
  },
  mo_fingeroffensive: {
    id: 'mo_fingeroffensive', name: '彈指神通 Finger Offensive', maxLv: 5,
    type: 'passive', passiveStat: 'fingerOffensive', element: 'neutral',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_investigate', level: 3 },
    mult: [8, 10, 12, 14, 16],
    procChance: [20, 20, 20, 20, 20], internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能。真劍狀態中，普通攻擊有 20% 機率發動（內部冷卻 5 秒）：'
        + '射出氣球體造成 ATK 800%~1600% 的遠距離物理傷害。'
  },
  /* 阿修羅霸凰拳：連段的終點，也是全遊戲最大的一發。
     官方是「消 5 球＋全部 SP，傷害隨消耗的 SP 大幅上升，無視迴避與大部分防禦，放完解除爆氣」。
     本作照做，倍率寫成 `8 + 消耗SP/100`——SP 500 就是 1300%，再加官方那欄固定傷害 400~1000。 */
  mo_extremityfist: {
    id: 'mo_extremityfist', name: '阿修羅霸凰拳 Asura Strike', maxLv: 5,
    type: 'passive', passiveStat: 'extremityFist', element: 'neutral',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_fingeroffensive', level: 3 },
    mult: [8, 8, 8, 8, 8],
    procChance: [20, 20, 20, 20, 20], spiritCost: 5,
    spScale: 100, flatBonus: [400, 550, 700, 850, 1000],
    desc: '被動技能。必須在爆氣狀態，猛龍誇強觸發後有 20% 機率接上：'
        + '消耗 5 顆氣球體與**全部 SP**，造成無視迴避與防禦的巨大傷害'
        + '（ATK 倍率 800% ＋ 消耗SP÷100，另加 400~1000 點固定傷害），放完解除爆氣狀態。'
  },
  mo_bodyrelocation: {
    id: 'mo_bodyrelocation', name: '弓身彈影 Body Relocation', maxLv: 1,
    type: 'passive', passiveStat: 'bodyRelocation',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_extremityfist', level: 3 },
    mult: [25],
    desc: '被動技能。生怪速度 +25%。（官方是瞬間移動，本作沒有座標，'
        + '比照騎士的騎乘術改成生怪加速）'
  },
  /* 發勁：官方 maxLv 0（未開放）。使用者指定轉職自動獲得、做成普攻觸發。
     自傷 200 HP **永遠留 1 HP**，跟聖十字審判同一套保險。 */
  mo_balkyoung: {
    id: 'mo_balkyoung', name: '發勁 Ki Explosion', maxLv: 1,
    type: 'passive', passiveStat: 'balkyoung', element: 'neutral', autoGrant: true,
    spCost: [0], cooldown: [0],
    mult: [4], procChance: [20], hpCost: [200],
    stunChance: [50], stunSec: [1], internalCooldown: [10],
    desc: '被動技能，轉職時自動獲得。普通攻擊有 20% 機率發動（內部冷卻 10 秒）：消耗 200 HP，'
        + '對目標造成 ATK 400% 傷害，並對全體有 50% 機率暈眩 1 秒。'
        + 'HP 低於 25% 時自動不放，而且自傷永遠留 1 HP。'
  },
  /* 振氣注入：官方 maxLv 0，效果是把自己的 1 顆氣球體給隊友。
     本作**還沒有隊伍系統**，所以判定寫得出來、但永遠找不到接收者——
     跟十字軍的犧牲、流氓的流氓天國是同一批，等隊友模式才會亮。 */
  mo_kitranslation: {
    id: 'mo_kitranslation', name: '振氣注入 Ki Translation', maxLv: 1,
    type: 'passive', passiveStat: 'kiTranslation',
    spCost: [0], cooldown: [0], mult: [1],
    internalCooldown: [5],
    desc: '被動技能。氣球體滿 5 顆時，隨機分 1 顆給隊友（內部冷卻 5 秒）。'
        + '**本作目前沒有隊伍系統，所以這個技能不會有任何作用**，等隊友模式開放才會生效。'
  },

  /* ================= 賢者 SA_（#71）=================

     官方 22 個技能**全部做出來**，連五個 maxLv 0 的都在。

     最大的一件事：**本作完全沒有「詠唱」這個概念**（#55 已經把施法時間整批魔改成冷卻秒數），
     而官方賢者有四個技能建立在詠唱上——取消施法、自由施法、魔法懲罰、念咒拆除。
     使用者 2026-08-10 指定的重新定位寫在各技能的註解裡。

     ---- 資源 ----
     四種靈礦石（火 boody_red／水 crystal_blue／風 wind_of_verdure／地 yellow_live）
     各有 7~13 種怪會掉；藍／黃魔力礦石也各有 11~12 種。
     **四種靈碎片（scarlet_pts 等）本作沒有任何怪會掉、商店也沒賣**，
     所以屬性附加做成「碎片優先、沒有就吃礦石」——不然那四招永遠放不出來。

     ---- 官方對照 ----
       SA_ADVANCEDBOOK   進化之書       → sa_advancedbook
       SA_DRAGONOLOGY    龍知識         → sa_dragonology
       SA_FLAMELAUNCHER  火屬性附加     → sa_flamelauncher（水／風／地各一）
       SA_VOLCANO        火元素領域     → sa_volcano（水／風／地各一，互斥）
       SA_CASTCANCEL     取消施法       → sa_castcancel（無詠唱 → 技能 SP 消耗）
       SA_FREECAST       自由施法       → sa_freecast（無詠唱 → 自動念咒機率＋攻速）
       SA_AUTOSPELL      自動念咒       → sa_autospell（自選一個魔法，獨立冷卻）
       SA_MAGICROD       魔法懲罰       → sa_magicrod（無詠唱時機 → 受怪物技能攻擊時免傷）
       SA_SPELLBREAKER   念咒拆除       → sa_spellbreaker（無詠唱 → 普攻觸發的固定比例傷害）
       SA_DISPELL        魔法效果解除   → sa_dispell（`mon.mbuff` 就是現成的對象）
       SA_ABRACADABRA    隨機技能       → sa_abracadabra
       SA_CREATECON      肯貝特製作     → sa_createcon（官方 maxLv 0；轉職獲得，開啟武器附魔面板）
       SA_ELEMENT*       四個元素更換   → sa_element*（官方 maxLv 0；轉職獲得，面板選一種屬性） */

  sa_advancedbook: {
    id: 'sa_advancedbook', name: '進化之書 Advanced Book', maxLv: 10,
    type: 'passive', passiveStat: 'advancedBook', requiresWeapon: 'book',
    spCost: [0], cooldown: [0],
    mult: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    aspdPct: [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5],
    desc: '被動技能。以書本攻擊時 ATK +3~30、攻速 +0.5%~5%。'
  },
  sa_dragonology: {
    id: 'sa_dragonology', name: '龍知識 Dragonology', maxLv: 5,
    type: 'passive', passiveStat: 'dragonology',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'sa_advancedbook', level: 9 },
    mult: [4, 8, 12, 16, 20],
    matkPct: [2, 4, 6, 8, 10], intBonus: [1, 1, 2, 2, 3],
    desc: '被動技能。對龍族的物理傷害 +4%~20%、魔法傷害 +2%~10%，'
        + '受到龍族的傷害 −4%~20%，INT +1~3。'
  },

  /* 屬性附加 ×4。官方消耗對應的靈碎片×1，武器變該屬性並增加該屬性魔法傷害，10~30 分鐘。
     使用者 2026-08-10 指定：**照官方消耗，但礦石也能用，持續時間更長**（20~60 分鐘）。
     碎片本作打不到，所以實務上吃的是礦石——那四種礦石各有 7~13 種怪會掉。 */
  sa_flamelauncher: {
    id: 'sa_flamelauncher', name: '火屬性附加 Flame Launcher', maxLv: 5,
    type: 'buff_elementweapon', element: 'fire',
    spCost: [40, 40, 40, 40, 40], cooldown: [3, 3, 3, 3, 3],
    requires: { skillId: 'sa_advancedbook', level: 5 },
    mult: [1, 2, 3, 4, 5],
    duration: [1200, 1800, 2400, 3000, 3600],
    costItems: ['scarlet_pts', 'boody_red'],
    desc: '消耗火靈碎片或火靈礦石×1，武器變成火屬性並使火屬性傷害 +1%~5%，持續 20~60 分鐘。'
  },
  sa_frostweapon: {
    id: 'sa_frostweapon', name: '水屬性附加 Frost Weapon', maxLv: 5,
    type: 'buff_elementweapon', element: 'water',
    spCost: [40, 40, 40, 40, 40], cooldown: [3, 3, 3, 3, 3],
    requires: { skillId: 'sa_advancedbook', level: 5 },
    mult: [1, 2, 3, 4, 5],
    duration: [1200, 1800, 2400, 3000, 3600],
    costItems: ['indigo_pts', 'crystal_blue'],
    desc: '消耗水靈碎片或水靈礦石×1，武器變成水屬性並使水屬性傷害 +1%~5%，持續 20~60 分鐘。'
  },
  sa_lightningloader: {
    id: 'sa_lightningloader', name: '風屬性附加 Lightning Loader', maxLv: 5,
    type: 'buff_elementweapon', element: 'wind',
    spCost: [40, 40, 40, 40, 40], cooldown: [3, 3, 3, 3, 3],
    requires: { skillId: 'sa_advancedbook', level: 5 },
    mult: [1, 2, 3, 4, 5],
    duration: [1200, 1800, 2400, 3000, 3600],
    costItems: ['yellow_wish_pts', 'wind_of_verdure'],
    desc: '消耗風靈碎片或風靈礦石×1，武器變成風屬性並使風屬性傷害 +1%~5%，持續 20~60 分鐘。'
  },
  sa_seismicweapon: {
    id: 'sa_seismicweapon', name: '地屬性附加 Seismic Weapon', maxLv: 5,
    type: 'buff_elementweapon', element: 'earth',
    spCost: [40, 40, 40, 40, 40], cooldown: [3, 3, 3, 3, 3],
    requires: { skillId: 'sa_advancedbook', level: 5 },
    mult: [1, 2, 3, 4, 5],
    duration: [1200, 1800, 2400, 3000, 3600],
    costItems: ['lime_green_pts', 'yellow_live'],
    desc: '消耗地靈碎片或地靈礦石×1，武器變成地屬性並使地屬性傷害 +1%~5%，持續 20~60 分鐘。'
  },

  /* 元素領域 ×4。官方是設在地上的 7×7 領域，本作沒有座標 → **做成自身領域 buff**
     （消耗藍色魔力礦石×1，比照咖般塔音的礦石慣例）。

     **同時只能開一個**（`exclusiveGroup: 'elefield'`），但官方本來就有「開著一個時
     再開另一個不用礦石」這條，所以切換是免費的——這正好讓它變成一個「看怪物屬性換場」的技能。
     地元素領域官方是「消除地面效果」，本作沒有地面效果可消，使用者指定改成第四個屬性領域。

     **之後開放隊友模式時，這四個要改成全隊加成**（官方就是範圍內所有角色都吃）。 */
  sa_volcano: {
    id: 'sa_volcano', name: '火元素領域 Volcano', maxLv: 5,
    type: 'buff_elementfield', element: 'fire', exclusiveGroup: 'elefield',
    spCost: [48, 46, 44, 42, 40], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'sa_flamelauncher', level: 2 },
    mult: [10, 14, 17, 19, 20],
    atkFlat: [10, 15, 20, 25, 30],
    duration: [60, 120, 180, 240, 300],
    costItems: ['blue_gemstone'],
    desc: '消耗藍色魔力礦石×1，開啟火元素領域 1~5 分鐘：火屬性傷害 +10%~20%、ATK 與 MATK +10~30。'
        + '（同時只能開一個元素領域，但從別的領域切換過來不用再花礦石）'
  },
  sa_deluge: {
    id: 'sa_deluge', name: '水元素領域 Deluge', maxLv: 5,
    type: 'buff_elementfield', element: 'water', exclusiveGroup: 'elefield',
    spCost: [48, 46, 44, 42, 40], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'sa_frostweapon', level: 2 },
    mult: [10, 14, 17, 19, 20],
    maxHpPct: [5, 9, 12, 14, 15],
    duration: [60, 120, 180, 240, 300],
    costItems: ['blue_gemstone'],
    desc: '消耗藍色魔力礦石×1，開啟水元素領域 1~5 分鐘：水屬性傷害 +10%~20%、最大HP +5%~15%。'
        + '（同時只能開一個元素領域，但從別的領域切換過來不用再花礦石）'
  },
  sa_violentgale: {
    id: 'sa_violentgale', name: '風元素領域 Violent Gale', maxLv: 5,
    type: 'buff_elementfield', element: 'wind', exclusiveGroup: 'elefield',
    spCost: [48, 46, 44, 42, 40], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'sa_lightningloader', level: 2 },
    mult: [10, 14, 17, 19, 20],
    fleeFlat: [3, 6, 9, 12, 15],
    duration: [60, 120, 180, 240, 300],
    costItems: ['blue_gemstone'],
    desc: '消耗藍色魔力礦石×1，開啟風元素領域 1~5 分鐘：風屬性傷害 +10%~20%、迴避 +3~15。'
        + '（同時只能開一個元素領域，但從別的領域切換過來不用再花礦石）'
  },
  sa_landprotector: {
    id: 'sa_landprotector', name: '地元素領域 Land Protector', maxLv: 5,
    type: 'buff_elementfield', element: 'earth', exclusiveGroup: 'elefield',
    spCost: [66, 62, 58, 54, 50], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'sa_seismicweapon', level: 2 },
    mult: [10, 14, 17, 19, 20],
    defFlat: [10, 15, 20, 25, 30],
    duration: [120, 165, 210, 255, 300],
    costItems: ['blue_gemstone'],
    desc: '消耗藍色魔力礦石×1，開啟地元素領域 2~5 分鐘：地屬性傷害 +10%~20%、DEF +10~30。'
        + '（官方是「消除地面效果」，本作沒有地面效果可消，改成第四個屬性領域）'
  },

  /* 取消施法：官方是「取消詠唱中的技能並退還 10~90% SP」。無詠唱 →
     使用者指定改成被動的技能 SP 消耗折扣，併進高階祭司「魔力減免」那個既有的桶。
     數字沒有照官方的 −10~90%——那會讓賢者的技能幾乎免費。 */
  sa_castcancel: {
    id: 'sa_castcancel', name: '取消施法 Cast Cancel', maxLv: 5,
    type: 'passive', passiveStat: 'skillSpCostReduce',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'sa_advancedbook', level: 2 },
    mult: [5, 10, 15, 20, 25],
    desc: '被動技能。技能 SP 消耗 −5%~25%。（官方是取消詠唱並退還 SP，本作沒有詠唱）'
  },
  sa_freecast: {
    id: 'sa_freecast', name: '自由施法 Free Cast', maxLv: 10,
    type: 'passive', passiveStat: 'freeCast',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'sa_castcancel', level: 1 },
    mult: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    aspdPct: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    desc: '被動技能。自動念咒的觸發機率 +1%~10%、普攻攻速 +1%~10%。'
        + '（官方是「詠唱中仍可移動與攻擊」，本作沒有詠唱）'
  },
  /* 自動念咒：官方是主動 buff，選一個已學魔法，普攻機率自動施放，
     **發動等級上限是此技能等級的一半**（官方規則，照做）。
     使用者指定改成被動＋**獨立冷卻 3 秒，不吃技能本身的冷卻**——
     不然一個 20 秒冷卻的魔法會讓這個被動幾乎不動。
     挑哪一個魔法存在 `state.sageAutoSpellId`，UI 照抄襲那個下拉選單再做一個。 */
  sa_autospell: {
    id: 'sa_autospell', name: '自動念咒 Auto Spell', maxLv: 10,
    type: 'passive', passiveStat: 'sageAutoSpell',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'sa_freecast', level: 4 },
    mult: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    spCostPct: 67, internalCooldown: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    desc: '被動技能。自選一個已學會的魔法，普通攻擊有 2%~20% 機率自動施放'
        + '（獨立冷卻 3 秒，不受該魔法本身的冷卻影響）。SP 只花原本的 2/3，'
        + '發動等級上限是本技能等級的一半。'
  },
  /* 魔法懲罰：官方是「在被單體魔法擊中前一刻施展，擋下傷害並吸 SP」。
     本作沒有詠唱、也沒有「擊中前一刻」這個時機，但**怪物真的會放技能**（#45），
     所以使用者指定改成：受怪物技能攻擊時機率完全免傷並回 SP。 */
  sa_magicrod: {
    id: 'sa_magicrod', name: '魔法懲罰 Magic Rod', maxLv: 5,
    type: 'passive', passiveStat: 'magicRod',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'sa_advancedbook', level: 4 },
    mult: [5, 8, 12, 16, 20],
    spGain: [30, 30, 30, 30, 30], internalCooldown: [10, 9, 8, 6, 5],
    desc: '被動技能。受到怪物技能攻擊時有 5%~20% 機率完全免除該次傷害並回復 30 SP'
        + '（內部冷卻 10→5 秒）。'
  },
  /* 念咒拆除：官方是打斷詠唱、吸 SP、造成目標最大 HP 2% 的傷害。
     無詠唱可打斷 → 只留「最大 HP 2%」那半，改成普攻觸發，再照使用者指定補上暈眩。
     **對首領階級無效**是官方就有的限制，照抄。 */
  sa_spellbreaker: {
    id: 'sa_spellbreaker', name: '念咒拆除 Spell Breaker', maxLv: 5,
    type: 'passive', passiveStat: 'spellBreaker',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'sa_magicrod', level: 1 },
    mult: [5, 8, 12, 16, 20],
    hpPct: 2, spGain: [10, 20, 30, 40, 50], stunSec: [1, 1, 1, 1, 1],
    internalCooldown: [10, 9, 8, 6, 5],
    desc: '被動技能。普通攻擊有 5%~20% 機率造成目標最大 HP 2% 的傷害、暈眩 1 秒並回復 10~50 SP'
        + '（內部冷卻 10→5 秒）。對首領階級的目標**不造成傷害**（官方規則），暈眩照常判定。'
  },
  /* 魔法效果解除：官方是主動技，消耗黃色魔力礦石×1，機率解除目標身上的強化效果。
     本作 #36 之後怪物真的會給自己上 buff（`mon.mbuff`），所以這一招有實際對象。
     使用者指定改成輔助型被動：普攻 20% 觸發，**怪身上沒有 buff 就不觸發也不消耗礦石**。 */
  sa_dispell: {
    id: 'sa_dispell', name: '魔法效果解除 Dispell', maxLv: 5,
    type: 'passive', passiveStat: 'dispellProc',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'sa_spellbreaker', level: 3 },
    mult: [60, 70, 80, 90, 100],
    procChance: [20, 20, 20, 20, 20], internalCooldown: [10, 10, 10, 10, 10],
    costItems: ['yellow_gemstone'], costQty: 1,
    desc: '被動技能。普通攻擊有 20% 機率發動（內部冷卻 10 秒）：消耗黃色魔力礦石×1，'
        + '以 60%~100% 機率解除目標身上的所有強化效果。目標身上沒有強化效果時不會發動，也不會消耗礦石。'
  },
  /* 隨機技能：官方是消耗黃色魔力礦石×2 隨機發動一個技能。
     使用者指定池子限定**攻擊技能**、等級依本技能等級但不超過該技能自己的上限。
     技能池的查詢跟流氓的抄襲共用 `PLAGIARISM_ATTACK_TYPES`。 */
  sa_abracadabra: {
    id: 'sa_abracadabra', name: '隨機技能 Abracadabra', maxLv: 10,
    type: 'passive', passiveStat: 'abracadabra',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'sa_autospell', level: 5 },
    mult: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    procChance: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    internalCooldown: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    costItems: ['yellow_gemstone'], costQty: 2,
    desc: '被動技能。普通攻擊有 20% 機率發動（內部冷卻 10 秒）：消耗黃色魔力礦石×2，'
        + '隨機施放一個攻擊技能，等級＝本技能等級（不超過該技能自己的上限）。'
  },
  /* 肯貝特製作：官方 maxLv 0，做出可改變武器屬性 20 分鐘的道具。
     使用者指定改成**轉職直接獲得**，並在自動戰鬥面板開一個「肯貝特武器附魔」——
     選一種屬性就自動維持，消耗對應的靈礦石（背包 → 倉庫 → 付 1000z），每次 20 分鐘。 */
  sa_createcon: {
    id: 'sa_createcon', name: '肯貝特製作 Create Converter', maxLv: 1,
    type: 'passive', passiveStat: 'elementConverter', autoGrant: true,
    spCost: [0], cooldown: [0], mult: [1],
    duration: [1200], goldFallback: 1000,
    desc: '被動技能，轉職時自動獲得。自動戰鬥分頁多出「🔮 肯貝特武器附魔」，'
        + '選一種屬性就會自動維持 20 分鐘的武器屬性。'
        + '每次消耗對應的靈礦石×1（先找背包、再找倉庫，都沒有就付 1000 鋅幣）。'
  },
  /* 四個元素更換：官方 maxLv 0，消耗對應的肯貝特把目標變成該屬性。
     使用者指定轉職直接獲得、面板上四選一（下拉選單），普攻 20% 觸發，
     消耗所選屬性的靈礦石（背包 → 倉庫 → 付 1000z），敵人轉成該屬性 10 秒，**MVP 也吃**。
     四個技能共用同一組設定，只有 element 不同；實際會觸發的是面板選的那一個。 */
  sa_elementfire: {
    id: 'sa_elementfire', name: '火屬性元素更換 Elemental Change Fire', maxLv: 1,
    type: 'passive', passiveStat: 'elementChange', element: 'fire', autoGrant: true,
    spCost: [0], cooldown: [0], mult: [20],
    duration: [10], costItems: ['boody_red'], goldFallback: 1000,
    internalCooldown: [10],
    desc: '被動技能，轉職時自動獲得。在自動戰鬥分頁選定屬性後，普通攻擊有 20% 機率'
        + '把目標變成火屬性 10 秒（內部冷卻 10 秒，首領階級也有效）。'
        + '每次消耗火靈礦石×1（先找背包、再找倉庫，都沒有就付 1000 鋅幣）。'
  },
  sa_elementwater: {
    id: 'sa_elementwater', name: '水屬性元素更換 Elemental Change Water', maxLv: 1,
    type: 'passive', passiveStat: 'elementChange', element: 'water', autoGrant: true,
    spCost: [0], cooldown: [0], mult: [20],
    duration: [10], costItems: ['crystal_blue'], goldFallback: 1000,
    internalCooldown: [10],
    desc: '被動技能，轉職時自動獲得。在自動戰鬥分頁選定屬性後，普通攻擊有 20% 機率'
        + '把目標變成水屬性 10 秒（內部冷卻 10 秒，首領階級也有效）。'
        + '每次消耗水靈礦石×1（先找背包、再找倉庫，都沒有就付 1000 鋅幣）。'
  },
  sa_elementwind: {
    id: 'sa_elementwind', name: '風屬性元素更換 Elemental Change Wind', maxLv: 1,
    type: 'passive', passiveStat: 'elementChange', element: 'wind', autoGrant: true,
    spCost: [0], cooldown: [0], mult: [20],
    duration: [10], costItems: ['wind_of_verdure'], goldFallback: 1000,
    internalCooldown: [10],
    desc: '被動技能，轉職時自動獲得。在自動戰鬥分頁選定屬性後，普通攻擊有 20% 機率'
        + '把目標變成風屬性 10 秒（內部冷卻 10 秒，首領階級也有效）。'
        + '每次消耗風靈礦石×1（先找背包、再找倉庫，都沒有就付 1000 鋅幣）。'
  },
  sa_elementearth: {
    id: 'sa_elementearth', name: '地屬性元素更換 Elemental Change Earth', maxLv: 1,
    type: 'passive', passiveStat: 'elementChange', element: 'earth', autoGrant: true,
    spCost: [0], cooldown: [0], mult: [20],
    duration: [10], costItems: ['yellow_live'], goldFallback: 1000,
    internalCooldown: [10],
    desc: '被動技能，轉職時自動獲得。在自動戰鬥分頁選定屬性後，普通攻擊有 20% 機率'
        + '把目標變成地屬性 10 秒（內部冷卻 10 秒，首領階級也有效）。'
        + '每次消耗地靈礦石×1（先找背包、再找倉庫，都沒有就付 1000 鋅幣）。'
  },

  /* ================= 鍊金術士 AM_（#72）=================

     官方 26 個技能，本作做 16 個。使用者 2026-08-10 指定刪掉 10 個：
       菠色克投擲、寬廣配藥 1/2/3 —— 官方是「要跟其他職業組隊才拿得到」的特殊技
       生命工學研究、生命體、培養、治癒生命體、火焰控制、攻擊力訓練
         —— 六個都是餵養生命體實體的參數，本作的生命體不做成實體（見下）

     ---- 最大的一個決定：召喚不做實體 ----
     官方這職業有 12 條綁在「生命體」與「召喚物」上，而本作**玩家側召喚是 0 行**。
     使用者指定改成**定時自動攻擊的場域效果**——形狀跟既有的火柱攻擊／十字驅魔一樣
     （`state.activeFieldEffects`），不新增實體、不佔怪物欄位、不進命中判定：
       生物調撥    5000z    每 3 秒 ATK 100~300% ＋自補 500 HP，持續 1 分鐘
       生命體召喚  100000z  每 3 秒 ATK 1000~3000%，持續 30 分鐘
     「養寵物」那一層換成**鋅幣**：生命體召喚一次 10 萬，而整條技能樹在做的事
     就是把這個數字壓下來（見下面的折扣鏈）。

     ---- 折扣鏈 ----
       知識藥水 Lv1~10   所有鍊金術技能的鋅幣 −1~10%
       配藥 Lv9          所有鍊金術技能的鋅幣 −30%
       安息              生命體召喚 −20%
       復活生命體        生命體召喚 −20%
     四者相乘：生命體召喚從 100,000 壓到 40,320。

     ---- 配藥是整個職業的鑰匙 ----
     使用者指定的等級門檻，前四級同時也是其他技能的前置：
       Lv1 火煙瓶 → 火煙瓶投擲　Lv2 鹽酸瓶 → 強酸攻擊
       Lv3 植物瓶 → 氣泡蟲召喚／生物調撥　Lv4 護貝藥 → 化學保護 ×4
       Lv5~8 依序解鎖火／水／地／風四種屬性抵抗藥水（本作原本是沒有任何效果的雜物）
       Lv9 鋅幣消耗 −30%　Lv10 隊友也能用抵抗藥水（**等隊伍系統**）

     ---- 官方對照 ----
       AM_LEARNINGPOTION 知識藥水      → am_learningpotion
       AM_PHARMACY       配藥          → am_pharmacy（被動化：等級＝解鎖表）
       AM_AXEMASTERY     斧劍熟練度    → am_axemastery
       AM_POTIONPITCHER  藥水投擲      → am_potionpitcher（被動化：吃消耗品時回復更多）
       AM_DEMONSTRATION  火煙瓶投擲    → am_demonstration
       AM_ACIDTERROR     強酸攻擊      → am_acidterror（唯一保留成主動的攻擊技）
       AM_SPHEREMINE     氣泡蟲召喚    → am_spheremine（隨機 1~3 隻的固定傷害）
       AM_CANNIBALIZE    生物調撥      → am_cannibalize
       AM_CP_*           化學保護 ×4   → am_cp_helm / shield / armor / weapon
       AM_BIOETHICS      生命倫理      → am_bioethics（官方 maxLv 0；轉職獲得）
       AM_CALLHOMUN      生命體召喚    → am_callhomun
       AM_REST           安息          → am_rest（被動化：折扣）
       AM_RESURRECTHOMUN 復活生命體    → am_resurrecthomun（被動化：折扣） */

  am_learningpotion: {
    id: 'am_learningpotion', name: '知識藥水 Learning Potion', maxLv: 10,
    type: 'passive', passiveStat: 'learningPotion',
    spCost: [0], cooldown: [0],
    mult: [5, 10, 15, 20, 25, 30, 35, 40, 45, 50],
    zenyCut: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    desc: '被動技能。藥水的 HP 回復效果 +5%~50%，鍊金術技能的鋅幣消耗 −1%~10%。'
        + '（官方第二欄是製藥成功率，本作沒有製藥失敗，改成費用折扣）'
  },
  /* 配藥：官方是主動的製作技能。本作沒有「拿著說明書做藥」這條線，
     使用者指定改成被動，**等級本身就是一張解鎖表**——
     前四級是其他技能的前置，5~8 級解鎖四種屬性抵抗藥水，9 級給折扣。 */
  am_pharmacy: {
    id: 'am_pharmacy', name: '配藥 Pharmacy', maxLv: 10,
    type: 'passive', passiveStat: 'pharmacy',
    spCost: [0], cooldown: [0],
    mult: [0, 0, 0, 0, 0, 0, 0, 0, 30, 30],
    resistPotionLv: { 5: 'resist_fire', 6: 'resist_water', 7: 'resist_earth', 8: 'resist_wind' },
    desc: '被動技能。等級決定你能用什麼：\n'
        + 'Lv1 火煙瓶（火煙瓶投擲）／Lv2 鹽酸瓶（強酸攻擊）／Lv3 植物瓶（氣泡蟲召喚・生物調撥）／Lv4 護貝藥（化學保護）\n'
        + 'Lv5 烈火抵抗藥水／Lv6 寒冰抵抗藥水／Lv7 大地抵抗藥水／Lv8 暴風抵抗藥水（各 −20% 該屬性傷害 30 分鐘）\n'
        + 'Lv9 鍊金術技能的鋅幣消耗 −30%／Lv10 隊友也能使用四屬抵抗藥水（本作尚無隊伍系統）'
  },
  am_axemastery: {
    id: 'am_axemastery', name: '斧頭和單手劍使用熟練度 Axe Mastery', maxLv: 10,
    type: 'passive', passiveStat: 'atkFlat', requiresWeapon: 'axesword',
    spCost: [0], cooldown: [0],
    mult: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30],
    desc: '被動技能。以斧頭或單手劍攻擊時 ATK +3~30。'
  },
  /* 藥水投擲：官方是「對目標投擲藥水」的主動技，本作沒有投擲對象（也沒有隊友），
     所以改成「自己吃消耗品時回復更多」。之後開放隊友系統時，
     使用消耗品要讓隊友也獲得 30% 的回復量（使用者 2026-08-10 備註）。 */
  am_potionpitcher: {
    id: 'am_potionpitcher', name: '藥水投擲 Potion Pitcher', maxLv: 5,
    type: 'passive', passiveStat: 'potionPitcher',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'am_pharmacy', level: 3 },
    mult: [10, 20, 30, 40, 50],
    desc: '被動技能。使用消耗品時的回復量變成 110%~150%。'
        + '（開放隊伍系統後，使用消耗品時隊友也會獲得 30% 的回復量）'
  },
  am_demonstration: {
    id: 'am_demonstration', name: '火煙瓶投擲 Demonstration', maxLv: 5,
    type: 'field_phys_aoe', element: 'fire',
    spCost: [10, 10, 10, 10, 10], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'am_pharmacy', level: 1 },
    zenyCost: [10000, 10000, 10000, 10000, 10000], alchemyCost: true,
    mult: [0.6, 1.2, 1.8, 2.4, 3.0],
    tickSec: 0.5, duration: [40, 45, 50, 55, 60],
    desc: '消耗 10,000 鋅幣布下火場：對場上全體每 0.5 秒造成 ATK 60%~300% 的火屬性傷害，'
        + '持續 40~60 秒。（官方是消耗火煙瓶×1，本作改成鋅幣）'
  },
  am_acidterror: {
    id: 'am_acidterror', name: '強酸攻擊 Acid Terror', maxLv: 5,
    type: 'damage', element: 'neutral',
    spCost: [15, 15, 15, 15, 15], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'am_pharmacy', level: 2 },
    zenyCost: [10000, 10000, 10000, 10000, 10000], alchemyCost: true,
    mult: [2, 4, 6, 8, 10],
    inflict: { type: 'bleed', chance: [3, 6, 9, 12, 15] },
    desc: '消耗 10,000 鋅幣，對目標造成 ATK 200%~1000% 的傷害，並有 3%~15% 機率使其出血。'
        + '（官方是消耗鹽酸瓶×1，本作改成鋅幣；破壞鎧甲那半本作沒有裝備損壞，不做）'
  },
  am_spheremine: {
    id: 'am_spheremine', name: '氣泡蟲召喚 Sphere Mine', maxLv: 5,
    type: 'bomb_random', element: 'neutral',
    spCost: [10, 10, 10, 10, 10], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'am_pharmacy', level: 3 },
    zenyCost: [5000, 5000, 5000, 5000, 5000], alchemyCost: true,
    mult: [2400, 2800, 3200, 3600, 4000],
    // 地雷在腳邊自爆，官方也沒有命中判定這一段（官方原文只寫「無視防禦」）
    alwaysHit: true,
    desc: '消耗 5,000 鋅幣，隨機挑場上 1~3 隻敵人引爆：每隻承受 2400~4000 點**無視防禦**的固定傷害，必中。'
        + '（官方是召喚會自爆的地雷，本作沒有召喚實體，只留自爆那一下）'
  },
  am_cannibalize: {
    id: 'am_cannibalize', name: '生物調撥 Cannibalize', maxLv: 5,
    type: 'alchemy_summon', element: 'neutral',
    spCost: [20, 20, 20, 20, 20], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'am_pharmacy', level: 3 },
    zenyCost: [5000, 5000, 5000, 5000, 5000], alchemyCost: true,
    mult: [1, 1.5, 2, 2.5, 3],
    healFlat: 500, tickSec: 3, duration: [60, 60, 60, 60, 60],
    desc: '消耗 5,000 鋅幣召出植物：每 3 秒對敵人造成 ATK 100%~300% 的傷害並為自己回復 500 HP，'
        + '持續 1 分鐘。（官方是召喚會攻擊的植物怪，本作改成定時自動攻擊）'
  },

  /* 化學保護 ×4。官方是「使裝備不會被卸除或損壞」——
     **本作裝備不會損壞，也沒有任何一隻怪的技能會卸除玩家裝備**，所以那個效果沒有對象。
     使用者 2026-08-10 指定四個各換一種實際的防護效果，全部消耗 5,000 鋅幣。 */
  am_cp_helm: {
    id: 'am_cp_helm', name: '化學頭盔保護 Chemical Protection Helm', maxLv: 5,
    type: 'buff_chemical',
    spCost: [20, 20, 20, 20, 20], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'am_pharmacy', level: 4 },
    zenyCost: [5000, 5000, 5000, 5000, 5000], alchemyCost: true,
    mult: [100, 100, 100, 100, 100], chemKind: 'def',
    duration: [120, 240, 360, 480, 600],
    desc: '消耗 5,000 鋅幣，DEF +100，持續 2~10 分鐘。'
  },
  am_cp_shield: {
    id: 'am_cp_shield', name: '化學盾牌保護 Chemical Protection Shield', maxLv: 5,
    type: 'buff_chemical', requiresEquip: 'shield',
    spCost: [25, 25, 25, 25, 25], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'am_cp_helm', level: 3 },
    zenyCost: [5000, 5000, 5000, 5000, 5000], alchemyCost: true,
    mult: [20, 20, 20, 20, 20], chemKind: 'block', internalCooldown: [10, 10, 10, 10, 10],
    duration: [120, 240, 360, 480, 600],
    desc: '消耗 5,000 鋅幣，被攻擊時 20% 機率完全免除傷害（內部冷卻 10 秒），持續 2~10 分鐘。需裝備盾牌。'
  },
  am_cp_armor: {
    id: 'am_cp_armor', name: '化學鎧甲保護 Chemical Protection Armor', maxLv: 5,
    type: 'buff_chemical',
    spCost: [25, 25, 25, 25, 25], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'am_cp_shield', level: 3 },
    zenyCost: [5000, 5000, 5000, 5000, 5000], alchemyCost: true,
    mult: [10, 10, 10, 10, 10], chemKind: 'maxhp',
    duration: [120, 240, 360, 480, 600],
    desc: '消耗 5,000 鋅幣，最大HP +10%，持續 2~10 分鐘。'
  },
  am_cp_weapon: {
    id: 'am_cp_weapon', name: '化學武器保護 Chemical Protection Weapon', maxLv: 5,
    type: 'buff_chemical',
    spCost: [30, 30, 30, 30, 30], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'am_cp_armor', level: 3 },
    zenyCost: [5000, 5000, 5000, 5000, 5000], alchemyCost: true,
    mult: [20, 20, 20, 20, 20], chemKind: 'weaponatk',
    duration: [120, 240, 360, 480, 600],
    desc: '消耗 5,000 鋅幣，武器 ATK +20%，持續 2~10 分鐘。'
  },

  /* 生命倫理：官方 maxLv 0，敘述直說「沒有任何效能，只是技能樹的起頭」。
     使用者指定轉職自動獲得——它的作用就是當生命體召喚的前置，本身照官方不給任何效果。 */
  am_bioethics: {
    id: 'am_bioethics', name: '生命倫理 Bioethics', maxLv: 1,
    type: 'passive', passiveStat: 'bioethics', autoGrant: true,
    spCost: [0], cooldown: [0], mult: [0],
    desc: '被動技能，轉職時自動獲得。本身沒有任何效果，是生命體召喚的前置。'
        + '（官方原文：「對於處理珍貴生命的人來說，再怎麼強調生命倫理也不為過。」）'
  },
  am_callhomun: {
    id: 'am_callhomun', name: '生命體召喚 Call Homunculus', maxLv: 5,
    type: 'alchemy_summon', element: 'neutral',
    spCost: [10, 10, 10, 10, 10], cooldown: [10, 10, 10, 10, 10],
    requires: { skillId: 'am_bioethics', level: 1 },
    zenyCost: [100000, 100000, 100000, 100000, 100000], alchemyCost: true, homunCost: true,
    mult: [10, 15, 20, 25, 30],
    tickSec: 3, duration: [1800, 1800, 1800, 1800, 1800],
    desc: '消耗 100,000 鋅幣召喚生命體：每 3 秒對敵人造成 ATK 1000%~3000% 的傷害，持續 30 分鐘。'
        + '費用吃得到知識藥水、配藥、安息與復活生命體的折扣（全滿時 40,320 鋅幣）。'
  },
  am_rest: {
    id: 'am_rest', name: '安息 Rest', maxLv: 1,
    type: 'passive', passiveStat: 'homunDiscount',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'am_bioethics', level: 1 },
    mult: [20],
    desc: '被動技能。生命體召喚的鋅幣消耗 −20%。（官方是把生命體收回休息，本作的生命體不是實體）'
  },
  am_resurrecthomun: {
    id: 'am_resurrecthomun', name: '復活生命體 Resurrect Homunculus', maxLv: 1,
    type: 'passive', passiveStat: 'homunDiscount',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'am_rest', level: 1 },
    mult: [20],
    desc: '被動技能。生命體召喚的鋅幣消耗 −20%。（官方是復活戰死的生命體，本作的生命體不是實體）'
  },

  /* ---------------- 聖殿十字軍 PA_（#74）----------------
     第一個**進階二轉的分支**（前六個進階二轉都在代表分支上）。官方 4 個技能全做。

     | 官方 | 本作 | 差異 |
     |---|---|---|
     | 連續盾擊 PA_SHIELDCHAIN | `pa_shieldchain` | 照官方 |
     | 神之威壓 PA_PRESSURE    | `pa_pressure`    | 照官方 |
     | 捨命攻擊 PA_SACRIFICE   | `pa_sacrifice`   | 前置改掉、加 HP 下限 |
     | 聖音 PA_GOSPEL          | `pa_gospel`      | 拿掉「不能動」，效果表由使用者指定 |

     **官方前置有一個接不上**：捨命攻擊要「犧牲 Lv3」，而犧牲（CR_DEVOTION）在本作
     沒有實作——它是把傷害轉移給隊友的技能，等隊伍系統。使用者 2026-08-14 指定前置改掉，
     這裡改成掛在霸體 Lv1（官方的另一個前置，本作有）。

     **命中修正 +20 做了**（#76 修正）：先前這裡寫「本作技能必中，所以 +20 沒東西可修正」
     是錯的——`case 'damage'` 一直都有命中判定。改用既有的 `hitBonusOnCast`（背刺那個欄位）。 */

  /* 官方：ATK 500%~1300%，「傷害會根據施展者的基本等級、盾牌重量和其精煉值而增加」。
     三個加成本作都有現成的欄位：盾重與精煉走迴旋盾擊那兩個（`shieldWeightMult` /
     `shieldRefineMult`，會併進武器那一桶，所以跟著吃屬性與體型），
     基本等級走轉生術那個 `levelScaleMax`（基本等級 99 時吃滿）。 */
  pa_shieldchain: {
    id: 'pa_shieldchain', name: '連續盾擊 Shield Chain', maxLv: 5,
    type: 'damage', element: 'neutral', requiresEquip: 'shield',
    spCost: [28, 31, 34, 37, 40], cooldown: [3, 3, 3, 3, 3],
    requires: { skillId: 'cr_shieldboomerang', level: 5 },
    mult: [5, 7, 9, 11, 13],
    shieldWeightMult: 1.0, shieldRefineMult: 4,
    levelScaleMax: 50,
    hitBonusOnCast: [20, 20, 20, 20, 20],
    desc: '需裝備盾牌。用盾牌連續攻擊，造成 ATK 500%~1300% 傷害，命中修正 +20，'
        + '並依盾牌的重量與精煉值額外增傷，傷害另隨基本等級上升（99 級時 +50%）。'
  },
  /* 官方：聖屬性魔法 MATK 650%~1250%，隨基本等級增加。
     **這招在坦身上不會痛**——十字軍線 matkMod 1.0、加點表 INT 只有 6 級。
     使用者 2026-08-14 指定照官方做，定位是「多一個玩法，不一定要強勢」，
     所以不另外給聖殿十字軍 matkMod 去補。想讓它痛就得自己堆 INT 與魔攻裝。 */
  pa_pressure: {
    id: 'pa_pressure', name: '神之威壓 Pressure', maxLv: 5,
    type: 'magic', element: 'holy',
    spCost: [30, 35, 40, 45, 50], cooldown: [5, 5, 5, 5, 5],
    requires: { skillId: 'cr_trust', level: 5 },
    mult: [6.5, 8.0, 9.5, 11.0, 12.5],
    levelScaleMax: 50,
    desc: '從空中召喚巨型十字架壓制敵人，造成聖屬性 MATK 650%~1250% 傷害，'
        + '傷害隨基本等級上升（99 級時 +50%）。'
  },
  /* 官方：SP 100，下 5 次普攻每次消耗 9% 的 HP，用該數值 ×100%~140% 當傷害，
     無視迴避與防禦。使用者 2026-08-14 指定照官方做，只加兩件事：
       持續時間 60~90 秒  官方沒有時限（放了就等你打完 5 下），本作補一個窗口
       HP 下限            「只限制沒血不能放，不會放到死掉就好」

     HP 下限這條是**武僧發勁那個坑的同一版**：自傷型的普攻觸發在高攻速下會把玩家
     釘在 1 HP。差別是發勁最後靠 10 秒冷卻壓住，這招官方就只有 5 次，
     所以不必加冷卻，只要「扣完會死就不扣」——次數留著，補完血再繼續。

     這招要強必須撐高 HP（傷害 = 最大HP 9% × 倍率），
     而堆 VIT 本來就會壓低攻速，5 次不會在一瞬間燒完。 */
  pa_sacrifice: {
    id: 'pa_sacrifice', name: '捨命攻擊 Sacrifice', maxLv: 5,
    type: 'buff_sacrifice', element: 'neutral',
    spCost: [100, 100, 100, 100, 100],
    cooldown: [60, 68, 75, 83, 90],          // 跟持續時間一樣長，同時只會有一份
    requires: { skillId: 'endure', level: 1 },
    charges: 5, hpCostPct: 9,
    mult: [1.0, 1.1, 1.2, 1.3, 1.4],
    duration: [60, 68, 75, 83, 90],
    desc: '持續 60~90 秒或用完 5 次為止：普攻時額外消耗 9% 最大HP，'
        + '以該數值的 100%~140% 對目標造成無視迴避與防禦的傷害。'
        + 'HP 不足以支付時這一次不觸發（次數留著），不會把自己打死。'
  },
  /* 官方是「唱頌 1 分鐘，期間無法移動、攻擊或使用技能」——放置遊戲不能有這種東西，
     使用者 2026-08-14 指定拿掉限制、改成輔助型的場域，其餘照官方：
     SP 80/100、機率 55%~100%、每 10 秒扣 HP 30/45 與 SP 20/35、持續 60 秒。

     效果表兩邊各自擲一次機率（官方就是「有機率」），正面給自己、負面給場上全部敵人。
     兩張表都由使用者指定，不是官方的隨機 buff 清單——官方那份要隊伍系統才有意義。 */
  pa_gospel: {
    id: 'pa_gospel', name: '聖音 Gospel', maxLv: 10,
    type: 'field_gospel', element: 'holy',
    spCost: [80, 80, 80, 80, 80, 100, 100, 100, 100, 100],
    cooldown: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
    requires: { skillId: 'cr_trust', level: 8 },
    chance: [55, 60, 65, 70, 75, 80, 85, 90, 95, 100],
    hpDrain: [30, 30, 30, 30, 30, 45, 45, 45, 45, 45],
    spDrain: [20, 20, 20, 20, 20, 35, 35, 35, 35, 35],
    tickSec: 10,
    duration: [60, 60, 60, 60, 60, 60, 60, 60, 60, 60],
    desc: '唱頌福音 60 秒，每 10 秒扣自身 HP 30/45 與 SP 20/35，'
        + '並各以 55%~100% 機率對自己與全體敵人隨機發動一種效果。'
        + '　自己：全素質+10／隨機補血 1~9999／異常狀態免疫／命中與迴避+20（各持續 10 秒）。'
        + '　敵人：無視防禦與迴避的 1~9999 亂數傷害／黑暗／中毒／10 級挑釁／無事發生。'
  },

  /* ---------------- 智者 PF_（#76）----------------
     賢者的進階二轉。官方 8 個技能全做，**前置全部照官方**——
     這職業運氣好，八個官方前置在本作全部存在（聖殿十字軍就缺了犧牲）。

     使用者 2026-08-14 的指定裡，五個改成被動（放置遊戲不該要人一直點），
     三個維持主動：易燃之網、雙倍投擲、HP轉換。

     | 官方 | 本作 | 改動 |
     |---|---|---|
     | 易燃之網 PF_SPIDERWEB     | `pf_spiderweb`    | 拿掉「同時最多 2 個」，加 CD 5 秒 |
     | 薄霧牆 PF_FOGWALL         | `pf_fogwall`      | 改被動：全體 50% 黑暗 2 秒，CD 10 秒 |
     | 雙倍投擲 PF_DOUBLECASTING | `pf_doublecasting`| 照官方 |
     | 速讀術 PF_MEMORIZE        | `pf_memorize`     | 詠唱本作沒有 → 改成雙倍投擲 +20% |
     | HP轉換 PF_HPCONVERSION    | `pf_hpconversion` | 照官方 |
     | 心神互換 PF_SOULCHANGE    | `pf_soulchange`   | 怪物沒有 SP → 改成普攻沉默 |
     | 精神耗弱術 PF_SOULBURN    | `pf_soulburn`     | 官方限 PVP、且怪物沒 SP → 改成沉默＋魔法傷害 |
     | 精神撼動 PF_MINDBREAKER   | `pf_mindbreaker`  | MATK 那半沒有對象（怪物沒有 matk 欄位），只留 MDEF |

     **兩個「本作沒有」的老問題又出現了**：詠唱時間（速讀術）與怪物的 SP
     （心神互換、精神耗弱術）。前者跟 #71 的取消施法／自由施法同一個坑，
     後者是本輪才發現的——681 隻怪有 mdef，**0 隻有 sp**。 */

  pf_spiderweb: {
    id: 'pf_spiderweb', name: '易燃之網 Spider Web', maxLv: 1,
    type: 'debuff_web', element: 'earth',
    spCost: [30], cooldown: [5],
    requires: { skillId: 'sa_dragonology', level: 4 },
    costItems: ['spiderweb'], goldFallback: 1000,
    fleeFlat: [50], duration: [8],
    desc: '消耗蜘蛛絲 ×1（背包沒有就找倉庫，都沒有則付 1,000 鋅幣），'
        + '使目標迴避 −50 持續 8 秒；期間目標受到的火屬性傷害加倍，'
        + '但網子會被那一擊燒掉。對 BOSS 無效。'
  },
  /* 官方是 5×3 的霧牆：進入的敵人黑暗，而且範圍內單體技能 75% 失敗、遠距離與魔法傷害大減。
     本作沒有座標，「牆」與「進入」都沒有對象；使用者 2026-08-14 指定只留黑暗那半，
     改成被動：普攻時對**全體敵人各判定一次**。 */
  pf_fogwall: {
    id: 'pf_fogwall', name: '薄霧牆 Fog Wall', maxLv: 1,
    type: 'passive', passiveStat: 'fogWall',
    spCost: [0], cooldown: [0],
    requires: [{ skillId: 'sa_violentgale', level: 2 }, { skillId: 'sa_deluge', level: 2 }],
    mult: [50], ailSec: [2], internalCooldown: [10],
    desc: '被動技能。普攻時對場上全體敵人各判定一次，50% 機率使其陷入黑暗 2 秒（內部冷卻 10 秒）。'
  },
  /* 官方：火箭／冰箭／雷擊術有機率立刻再放一次，持續 90 秒。照官方做。
     跟賢者的自動念咒是同一組技能池，兩個疊起來就是真正的連射。 */
  pf_doublecasting: {
    id: 'pf_doublecasting', name: '雙倍投擲 Double Casting', maxLv: 5,
    type: 'buff_doublecast', element: 'neutral',
    spCost: [40, 45, 50, 55, 60], cooldown: [90, 90, 90, 90, 90],
    requires: { skillId: 'sa_autospell', level: 1 },
    mult: [40, 50, 60, 70, 80],
    duration: [90, 90, 90, 90, 90],
    desc: '持續 90 秒：施放火箭術／冰箭術／雷擊術時，有 40%~80% 機率立刻再放一次（不另外消耗 SP）。'
  },
  /* 官方是「下 5 次技能的變動詠唱時間減半」，而本作沒有詠唱時間
     （跟 #71 的取消施法／自由施法撞同一面牆）。
     使用者 2026-08-14 指定改成被動：直接加在雙倍投擲的機率上。 */
  pf_memorize: {
    id: 'pf_memorize', name: '速讀術 Memorize', maxLv: 1,
    type: 'passive', passiveStat: 'memorize',
    spCost: [0], cooldown: [0],
    requires: [{ skillId: 'sa_advancedbook', level: 5 }, { skillId: 'sa_freecast', level: 5 },
               { skillId: 'sa_autospell', level: 1 }],
    mult: [20],
    desc: '被動技能。雙倍投擲的觸發機率 +20%。（官方是變動詠唱減半，本作沒有詠唱時間）'
  },
  /* 官方 detail 的兩欄是「SP 消耗 1~5」與「轉換率 10%~50%」，desc 寫「將自身 10% 的 HP 轉換成 SP」。
     所以本作的讀法是：**消耗當前 HP 的 10%，換到的 SP = 消耗量 × 轉換率**。
     用 `hpCostPct` 這個既有欄位（聖十字審判在用的那個），扣血與「HP 不足擋下來」
     都由通用那段處理，case 只負責換算——自己再扣一次就是雙重扣血。 */
  pf_hpconversion: {
    id: 'pf_hpconversion', name: 'HP轉換 HP Conversion', maxLv: 5,
    type: 'hp_convert', element: 'neutral',
    spCost: [1, 2, 3, 4, 5], cooldown: [5, 5, 5, 5, 5],
    requires: [{ skillId: 'spregen', level: 1 }, { skillId: 'sa_magicrod', level: 1 }],
    hpCostPct: 10, mult: [10, 20, 30, 40, 50],
    desc: '消耗當前 HP 的 10%，轉換成等同該數值 10%~50% 的 SP。HP 不足時放不出來。'
  },
  /* 官方是「與目標交換 SP，雙方各消耗一半」——**本作怪物沒有 SP 欄位**（681 隻有 mdef，0 隻有 sp），
     交換沒有對象。使用者 2026-08-14 指定改成普攻觸發的沉默。 */
  pf_soulchange: {
    id: 'pf_soulchange', name: '心神互換 Soul Change', maxLv: 1,
    type: 'passive', passiveStat: 'soulChange',
    spCost: [0], cooldown: [0],
    requires: [{ skillId: 'sa_magicrod', level: 3 }, { skillId: 'sa_spellbreaker', level: 2 }],
    mult: [20], ailSec: [1], internalCooldown: [5],
    desc: '被動技能。普攻時有 20% 機率使目標沉默 1 秒（內部冷卻 5 秒）。'
  },
  /* 官方「把目標 SP 變 0，Lv5 成功時造成該 SP 兩倍的魔法傷害，失敗時打自己，
     且只能在 PVP 與攻城戰使用」——本作三個前提都不成立（沒有 PVP、怪物沒有 SP）。
     使用者 2026-08-14 指定改成普攻觸發：沉默 + MATK 100%~200% 的魔法傷害。
     魔法傷害不判定命中（#76 的規則：MATK 必中）。 */
  pf_soulburn: {
    id: 'pf_soulburn', name: '精神耗弱術 Soul Burn', maxLv: 5,
    type: 'passive', passiveStat: 'soulBurn', element: 'ghost',
    spCost: [0], cooldown: [0],
    requires: [{ skillId: 'sa_castcancel', level: 5 }, { skillId: 'sa_magicrod', level: 3 },
               { skillId: 'sa_dispell', level: 3 }],
    mult: [40, 50, 60, 70, 70], ailSec: [1],
    dmgMult: [1.0, 1.25, 1.5, 1.75, 2.0],
    internalCooldown: [10, 9, 8, 7, 5],
    desc: '被動技能。普攻時有 40%~70% 機率使目標沉默 1 秒，成功時另外造成 MATK 100%~200% 的'
        + '念屬性魔法傷害（內部冷卻 10~5 秒）。'
  },
  /* 官方是 MDEF −12%~−60% 且 MATK +20%~+100%。
     **MATK 那半沒有對象**——怪物資料裡沒有 matk 欄位，怪物技能的傷害不是從 MATK 算的。
     使用者 2026-08-14 指定的數值是 MDEF −6%~−30%（官方的一半），只留這半。 */
  pf_mindbreaker: {
    id: 'pf_mindbreaker', name: '精神撼動 Mind Breaker', maxLv: 5,
    type: 'passive', passiveStat: 'mindBreaker',
    spCost: [0], cooldown: [0],
    requires: [{ skillId: 'spregen', level: 3 }, { skillId: 'pf_soulburn', level: 2 }],
    mult: [30, 32, 35, 37, 40],
    mdefCut: [6, 12, 18, 24, 30], duration: [10, 10, 10, 10, 10],
    internalCooldown: [10, 9, 8, 7, 5],
    desc: '被動技能。普攻時有 30%~40% 機率使目標的魔法防禦 −6%~−30%，持續 10 秒（內部冷卻 10~5 秒）。'
        + '（官方另有「目標 MATK 上升」的負面代價，本作怪物沒有 MATK 欄位，那半不實作）'
  },

  /* ---------------- 搞笑藝人／冷豔舞姬 CG_（#77）----------------
     詩人與舞孃的進階二轉。官方 6 個共用技能，本作做 5 個
     （傀儡師的把戲擱置，等隊伍系統——它是「把自身素質分一半給隊友」，沒有隊友就沒有對象）。

     | 官方 | 本作 |
     |---|---|
     | 落花伴著月光下的水車小屋 | `cg_moonlit`：合奏類，普攻免傷一次 |
     | 傀儡師的把戲             | 擱置（隊伍系統） |
     | 職人演奏家               | `cg_specialsinger`：被動 ASPD +1 |
     | 海羅默德的手杖           | `cg_hermode`：歌曲類，技能免傷一次 |
     | 命運的塔羅牌             | `cg_tarotcard`：被動，普攻 20% 觸發十選一 |
     | 奧義箭亂舞               | `cg_arrowvulcan`：照官方 |

     兩邊共用同一份定義（跟 `bd_*` 那十個詩舞共用技一樣），前置各自對到自己那條線。 */

  /* 官方是 5×5 的防護罩（無法進入，但仍會受外來攻擊）——本作沒有座標。
     使用者 2026-08-15 指定改成「被打到免傷一次，冷卻 10 秒」。
     走既有的 `block` 桶（自動防禦與化學盾牌保護同一個），機率 100 + 冷卻 10 秒；
     `blockScope: 'attack'` 讓它只擋普攻，技能那半是海羅默德的手杖負責。
     開隊伍後與冷豔舞姬同時掛就是兩份，10 秒內免傷兩次——桶本來就支援多筆。 */
  cg_moonlit: {
    id: 'cg_moonlit', name: '落花伴著月光下的水車小屋 Moonlit Water Mill', maxLv: 5,
    type: 'buff_block_timed', exclusiveGroup: 'ensemble',
    spCost: [30, 40, 50, 60, 70], cooldown: [20, 25, 30, 35, 40],
    requiresWeapon: 'instrument_whip',
    blockScope: 'attack', blockCdSec: 10,
    spDrain: [4, 8, 12, 16, 20], drainEverySec: 10,
    duration: [20, 25, 30, 35, 40],
    desc: '合奏類（同時只能開一個）。持續 20~40 秒，每 10 秒扣 SP 4~20：'
        + '被普攻打到時免傷一次，冷卻 10 秒。'
  },
  cg_specialsinger: {
    id: 'cg_specialsinger', name: '職人演奏家 Longing for Freedom', maxLv: 1,
    type: 'passive', passiveStat: 'aspdFlat',
    spCost: [0], cooldown: [0],
    mult: [1],
    desc: '被動技能，攻擊速度 +1。（官方是解除合奏後遺症，本作沒有那個後遺症）'
  },
  /* 官方限攻城戰、而且是給隊友魔法免疫——兩個前提本作都沒有。
     使用者 2026-08-15 指定改成「被技能打到免傷一次，冷卻 10 秒」。 */
  cg_hermode: {
    id: 'cg_hermode', name: '海羅默德的手杖 Wand of Hermode', maxLv: 5,
    type: 'buff_block_timed', exclusiveGroup: 'song',
    spCost: [20, 30, 40, 50, 60], cooldown: [10, 20, 30, 40, 50],
    requiresWeapon: 'instrument_whip',
    blockScope: 'skill', blockCdSec: 10,
    duration: [10, 20, 30, 40, 50],
    desc: '歌曲類（同時只能開一個）。持續 10~50 秒：被怪物技能打到時免傷一次，冷卻 10 秒。'
  },
  /* 官方是主動、8%~40% 機率抽 14 張塔羅牌其中一張。
     使用者 2026-08-15 指定改成被動、普攻 20% 觸發，效果表十選一（見 TAROT_CARDS）。 */
  cg_tarotcard: {
    id: 'cg_tarotcard', name: '命運的塔羅牌 Tarot Card of Fate', maxLv: 1,
    type: 'passive', passiveStat: 'tarotCard',
    spCost: [0], cooldown: [0],
    mult: [20], internalCooldown: [10],
    desc: '被動技能。普攻時有 20% 機率抽一張塔羅牌（內部冷卻 10 秒），十種效果隨機一種：'
        + '沉默 2 秒／詛咒+暈眩+中毒／無視防禦 6666 傷害／無視防禦 4444 傷害／'
        + 'ATK −20% 10 秒／解除敵方全部增益／無視防禦 1000 傷害／隨機兩種效果／'
        + '睡眠或冰凍或石化／ATK 迴避 命中 防禦全部 −20% 10 秒。'
  },
  cg_arrowvulcan: {
    id: 'cg_arrowvulcan', name: '奧義箭亂舞 Arrow Vulcan', maxLv: 10,
    type: 'damage', element: 'neutral',
    spCost: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
    cooldown: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    requiresWeapon: 'instrument_whip', consumeAmmo: 1,
    mult: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    levelScaleMax: 50,
    desc: '需裝備樂器或鞭，消耗箭矢 ×1。連射造成 ATK 600%~1500% 傷害，'
        + '傷害隨基本等級上升（99 級時 +50%）。'
  },

  /* ---------------- 創造者 BC_（#78）----------------
     鍊金術士的進階二轉。官方 6 個做 3 個——使用者 2026-08-15 指定刪掉
     植物栽培（召喚實體，本作玩家側召喚是 0 行）與鍊金術／藥水合成
     （官方連 desc 都沒有，`maxLv: -1`，是開製作介面用的空技能）。 */

  /* 官方是對 7×7 友方投擲纖細藥水。單人沒有友方，使用者指定改成被動的喝藥加成。
     跟藥水投擲同一個桶，但**取大值不相加**——兩個都是「喝藥回復量」，
     相加會變成 110%+150%，那不是官方任何一級的數字。 */
  bc_slimpitcher: {
    id: 'bc_slimpitcher', name: '纖細藥水投擲 Slim Pitcher', maxLv: 10,
    type: 'passive', passiveStat: 'potionPitcher',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'am_potionpitcher', level: 5 },
    mult: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    desc: '被動技能。使用消耗品時的回復量變成 110%~200%（與藥水投擲取較高的那個，不疊加）。'
        + '（開放隊伍系統後，隊友也會獲得 50% 的回復量）'
  },
  /* 官方 ATK 200%~2000%，傷害隨**目標的 VIT**、施展者的 INT 與基本等級增加。
     本作怪物沒有 vit 欄位，使用者 2026-08-15 指定用 `defSoft` 代替——
     軟防本來就是從 VIT 推導的，是同一個東西的下游。
     破壞武器／鎧甲那半不做：本作裝備不會損壞，怪也沒有裝備（跟強酸攻擊同一個理由）。 */
  bc_aciddemonstration: {
    id: 'bc_aciddemonstration', name: '強酸火煙瓶投擲 Acid Demonstration', maxLv: 10,
    type: 'damage', element: 'neutral',
    spCost: [50, 50, 50, 50, 50, 50, 50, 50, 50, 50],
    cooldown: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
    requires: [{ skillId: 'am_demonstration', level: 5 }, { skillId: 'am_acidterror', level: 5 }],
    zenyCost: [30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000, 30000],
    alchemyCost: true,
    mult: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20],
    targetSoftDefScale: 1, intScaleMax: 50, levelScaleMax: 50,
    desc: '消耗 30,000 鋅幣，造成 ATK 200%~2000% 傷害。'
        + '傷害隨**目標的軟防**（官方是目標 VIT，本作怪物沒有 VIT 欄位，用它推導出來的軟防代替）、'
        + '自身 INT 與基本等級上升。'
  },
  /* 官方是四件裝備同時免於卸除與損壞——本作兩件事都不存在（#72 已確認）。
     所以做成「四個化學保護一次全掛」，代價是單樣的兩倍價錢。 */
  bc_fullprotection: {
    id: 'bc_fullprotection', name: '所有化學武器保護 Full Chemical Protection', maxLv: 5,
    type: 'buff_chemical', chemKind: 'all',
    spCost: [40, 40, 40, 40, 40], cooldown: [5, 5, 5, 5, 5],
    requires: [{ skillId: 'am_cp_weapon', level: 5 }, { skillId: 'am_cp_armor', level: 5 },
               { skillId: 'am_cp_shield', level: 5 }, { skillId: 'am_cp_helm', level: 5 }],
    zenyCost: [10000, 10000, 10000, 10000, 10000], alchemyCost: true,
    mult: [100, 100, 100, 100, 100],
    duration: [120, 240, 360, 480, 600],
    desc: '消耗 10,000 鋅幣（單樣的兩倍），一次掛滿四個化學保護：'
        + 'DEF +100／被攻擊時 20% 機率免傷（需裝盾，冷卻 10 秒）／最大HP +10%／武器ATK +20%，持續 2~10 分鐘。'
        + '（開放隊伍系統後，隊友也會獲得一半效果）'
  },

  /* ---------------- 神行太保 ST_（#79）----------------
     流氓的進階二轉。官方 4 個全做。 */

  /* 官方「抵擋怪物或劍類武器的攻擊」——本作怪物沒有武器種類欄位，
     使用者 2026-08-15 指定改成「怪物攻擊」全包，其餘照官方：
     機率 15%~75%、最多 3 次、抵擋時只受一半傷害、且把擋下的那半反射回去。 */
  st_rejectsword: {
    id: 'st_rejectsword', name: '霸王魂 Reject Sword', maxLv: 5,
    type: 'buff_reject', element: 'neutral',
    spCost: [10, 15, 20, 25, 30], cooldown: [30, 30, 30, 30, 30],
    mult: [15, 30, 45, 60, 75], charges: 3,
    duration: [300, 300, 300, 300, 300],
    desc: '持續 300 秒或用完 3 次為止：受到怪物攻擊時有 15%~75% 機率只吃一半傷害，'
        + '並把擋下的那一半反射給對方。'
  },
  /* 官方核心是「隱身、不能攻擊、移速下降、SP 不自然恢復」——
     放置遊戲不能有「不能攻擊」。使用者 2026-08-15 指定**只保留 STR 加成那半**。 */
  st_chasewalk: {
    id: 'st_chasewalk', name: '暗影追蹤 Chase Walk', maxLv: 5,
    type: 'buff_flatstat', element: 'neutral',
    spCost: [10, 10, 10, 10, 10], cooldown: [30, 30, 30, 30, 30],
    // 官方前置是潛遁 Lv3，但本作的潛遁 maxLv 是 1（#69 壓縮過），照抄會變成永遠學不到
    requires: [{ skillId: 'hiding', level: 5 }, { skillId: 'rg_tunneldrive', level: 1 }],
    strBonus: [1, 2, 4, 8, 16], mult: [0],
    duration: [30, 30, 30, 30, 30],
    desc: 'STR +1~16，持續 30 秒。（官方另有隱身與移速下降，本作沒有位置概念，只留素質那半）'
  },
  /* 官方是「被技能打到不會改變抄襲記住的技能」——本作的抄襲是自己挑的，沒有被打掉的問題。
     使用者 2026-08-15 指定改成「讓抄襲也能選被動攻擊技」。 */
  st_preserve: {
    id: 'st_preserve', name: '自由保護 Preserve', maxLv: 1,
    type: 'passive', passiveStat: 'preserve',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'rg_plagiarism', level: 10 },
    mult: [1],
    desc: '被動技能。抄襲的候選名單多出**被動攻擊技**（原本只能挑主動攻擊技）。'
  },
  st_fullstrip: {
    id: 'st_fullstrip', name: '所有卸除 Full Strip', maxLv: 5,
    type: 'passive', passiveStat: 'fullStrip',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'rg_stripweapon', level: 5 },
    mult: [7, 9, 11, 13, 15],
    duration: [75, 90, 105, 120, 135],
    desc: '被動技能。普攻時有 7%~15% 機率**同時**發動卸除頭盔、盾牌、鎧甲與武器，持續 75~135 秒。'
  },

  /* ---------------- 武術宗師 CH_（#79）----------------
     武僧的進階二轉。官方 4 個全做，**四個都改成被動**（跟 #70 武僧整條線一致）。

     連段鏈接上去之後長這樣：
       六合拳 → 連環全身掌 → 猛龍誇強 ┬→ 伏虎拳 → 氣絕崩擊 → 阿修羅霸凰拳
       普攻（爆氣中）→ 猛虎硬派山 ────┘
     氣球體上限在武術宗師身上從 5 提高到 7（使用者指定），
     否則新增的兩招各花 1 顆會把阿修羅的 5 顆擠掉——#70 已經踩過一次那個死鎖。 */

  ch_soulcollect: {
    id: 'ch_soulcollect', name: '狂蓄氣 Soul Collect', maxLv: 1,
    type: 'passive', passiveStat: 'soulCollect',
    spCost: [0], cooldown: [0],
    requires: { skillId: 'mo_explosionspirits', level: 5 },
    mult: [5], internalCooldown: [5],
    desc: '被動技能。普攻時有 5% 機率一口氣補滿 5 顆氣球體（內部冷卻 5 秒）。'
  },
  ch_palmstrike: {
    id: 'ch_palmstrike', name: '猛虎硬派山 Palm Strike', maxLv: 5,
    type: 'passive', passiveStat: 'palmStrike',
    spCost: [0], cooldown: [0],
    requires: [{ skillId: 'mo_ironhand', level: 7 }, { skillId: 'mo_callspirits', level: 5 }],
    mult: [3, 4, 5, 6, 7], strScale: 200,
    chance: [20, 20, 20, 20, 20], stunSec: [1, 1, 1, 1, 1],
    chainChance: [20, 20, 20, 20, 20], internalCooldown: [5, 5, 5, 5, 5],
    desc: '被動技能，需爆氣狀態。普攻時有 20% 機率造成 ATK 300%~700% 傷害並使目標暈眩 1 秒'
        + '（傷害隨 STR 與基本等級上升，內部冷卻 5 秒），之後有 20% 機率接上伏虎拳。'
  },
  ch_tigerfist: {
    id: 'ch_tigerfist', name: '伏虎拳 Tiger Fist', maxLv: 5,
    type: 'passive', passiveStat: 'tigerFist',
    spCost: [0], cooldown: [0],
    requires: [{ skillId: 'mo_ironhand', level: 5 }, { skillId: 'mo_tripleattack', level: 5 },
               { skillId: 'mo_combofinish', level: 3 }],
    mult: [6.5, 8, 9.5, 11, 12.5], cost: 1,
    chance: [20, 20, 20, 20, 20],
    stunChance: [20, 30, 40, 50, 60], stunSec: [2, 2, 2, 2, 2],
    chainChance: [20, 20, 20, 20, 20],
    desc: '被動技能。猛虎硬派山或猛龍誇強發動後有 20% 機率觸發：消耗 1 顆氣球體，'
        + '造成 ATK 650%~1250% 傷害，20%~60% 機率使目標暈眩 2 秒，之後有 20% 機率接上氣絕崩擊。'
  },
  ch_chaincrush: {
    id: 'ch_chaincrush', name: '氣絕崩擊 Chain Crush', maxLv: 10,
    type: 'passive', passiveStat: 'chainCrush',
    spCost: [0], cooldown: [0],
    requires: [{ skillId: 'mo_ironhand', level: 5 }, { skillId: 'mo_callspirits', level: 5 },
               { skillId: 'ch_tigerfist', level: 2 }],
    mult: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20], cost: 1,
    chance: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    desc: '被動技能。伏虎拳發動後有 20% 機率觸發：消耗 1 顆氣球體，造成 ATK 200%~2000% 傷害。'
        + '之後在爆氣狀態下可以接上阿修羅霸凰拳（機率與猛龍誇強那條相同）。'
  },
};
