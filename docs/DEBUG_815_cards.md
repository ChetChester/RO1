# DEBUG 待辦：815 筆「名稱是卡片卻是道具」無法插卡

- 產生時間：2026-08-21
- 來源：ITEMS `1259` 筆 _card（type:material） vs CARDS `557` 筆可插，差 `815` 筆有道具無效果
- 判定：insertCard() js/engine.js:11327 `if(!CARDS[cardId]) return false`
- 分類：有怪物掉落(排除卡冊) 424 筆 / 無任何掉落 391 筆

| # | cardId | 中文名 | 怪物掉落數 | 示例怪物 | CARDS | ITEMS |
|---|---|---|---|---|---|---|
| 1 | 2018_visionary_card | Phantom's Spirit | 0 | - | N | Y |
| 2 | abyss_ancientking_card | 深層の古王グローザカード | 0 | - | N | Y |
| 3 | abyss_man_card | 深淵礦工魔卡片 | 1 | abyssman | N | Y |
| 4 | acidus_b_card | 暗黑俄希托斯卡片 | 0 | - | N | Y |
| 5 | acidus_s_card | 銀白光俄希托斯卡片 | 0 | - | N | Y |
| 6 | adventures_card | 11thアニバーサリーカード | 0 | - | N | Y |
| 7 | agnes_card | 阿格奈什卡片 | 0 | - | N | Y |
| 8 | ahat_card | 魔神使徒阿哈特卡片 | 1 | mm_gb_morocc_1 | N | Y |
| 9 | air_ship_raid_card | 飛空艇襲擊隊卡片 | 6 | e1_rotar_zairo,e1_gremlin | N | Y |
| 10 | airship_raid_card | 飛空艇襲擊隊卡片 | 0 | - | N | Y |
| 11 | aliot_card | 愛麗俄卡片 | 1 | aliot | N | Y |
| 12 | aliza_card | 愛麗哲卡片 | 2 | aliza,c3_aliza | N | Y |
| 13 | alnoldi_ex_card | 特殊泰坦魔芋花卡片 | 1 | md_alnoldi_ex | N | Y |
| 14 | alnoldi_ex_h_card | 夢魘特殊泰坦魔芋花卡片 | 1 | md_alnoldi_ex_h | N | Y |
| 15 | amdarais_card | 闇答萊屍卡片 | 1 | mg_amdarais | N | Y |
| 16 | amdarais_h_card | 覺醒闇答萊屍卡片 | 0 | - | N | Y |
| 17 | amdaraish_card | 覺醒闇答萊屍卡片 | 0 | - | N | Y |
| 18 | amitera_card | 變異阿米特拉凱美拉卡片 | 1 | chimera_amitera | N | Y |
| 19 | ancient_megalith_card | 古代邪惡摩艾卡片 | 1 | ill_megalith | N | Y |
| 20 | ancient_s_shooter_card | 古代石炮火樹卡片 | 1 | ill_stone_shooter | N | Y |
| 21 | ancient_sta_golem_card | 古代鐘乳巨石怪卡片 | 1 | ill_stalactic_golem | N | Y |
| 22 | ancient_tao_gunka_card | 古代塔奧群卡卡片 | 1 | ill_tao_gunka | N | Y |
| 23 | ancient_tree_card | 異種神木卡片 | 0 | - | N | Y |
| 24 | ancient_trijoint_card | 古代三葉蟲卡片 | 1 | ill_tri_joint | N | Y |
| 25 | ancient_w_deffend_card | 古代伍坦防禦者卡片 | 1 | ill_wootan_defender | N | Y |
| 26 | ancient_w_fighter_card | 古代伍坦戰士卡片 | 1 | ill_wootan_fighter | N | Y |
| 27 | ancient_w_shooter_card | 古代伍坦彈弓手卡片 | 1 | ill_wootan_shooter | N | Y |
| 28 | ancientking_groza_card | 古王グローザカード | 0 | - | N | Y |
| 29 | angel_iceslug_card | Angel Iceslug Card | 0 | - | N | Y |
| 30 | angelgolt_card | 天使方體惡魔卡片 | 0 | - | N | Y |
| 31 | anger_gazeti_card | 憤怒寒冰雕像卡片 | 1 | ill_gazeti | N | Y |
| 32 | anger_ice_titan_card | 憤怒寒冰巨人卡片 | 1 | ill_ice_titan | N | Y |
| 33 | anger_snowier_card | 憤怒雪怪卡片 | 1 | ill_snowier | N | Y |
| 34 | angergazeti_card | 憤怒寒冰雕像卡片 | 0 | - | N | Y |
| 35 | angericetitan_card | 憤怒寒冰巨人卡片 | 0 | - | N | Y |
| 36 | angermoonlight_card | 憤怒月夜貓卡片 | 1 | ill_moonlight | N | Y |
| 37 | angerninetail_card | 憤怒九尾狐卡片 | 1 | ill_nine_tail | N | Y |
| 38 | angersnowier_card | 憤怒雪怪卡片 | 0 | - | N | Y |
| 39 | angra_mantis_card | 瘋狂螳螂卡片 | 3 | angra_mantis,c5_angra_mantis | N | Y |
| 40 | ant_buyanne_card | 死亡藤蔓卡片 | 0 | - | N | Y |
| 41 | antique_book_card | 古靈精怪書卡片 | 1 | antique_book | N | Y |
| 42 | antiquebook_card | 古靈精怪書卡片 | 0 | - | N | Y |
| 43 | antonio_card | 邪惡老公公卡片 | 2 | antonio,xm_antonio | N | Y |
| 44 | aqua_elemental_card | 水元素卡片 | 1 | aqua_elemental | N | Y |
| 45 | aquila_card | 阿奎拉卡片 | 0 | - | N | Y |
| 46 | arc_elder_card | 邪靈長老卡片 | 0 | - | N | Y |
| 47 | archbishop_card | 闇·大主教 瑪嘉雷特卡片 | 1 | v_b_magaleta | N | Y |
| 48 | archi_card | 雅樂西卡片 | 1 | geffen_mage_1 | N | Y |
| 49 | aries_card | 艾里厄斯卡片 | 1 | md_aries | N | Y |
| 50 | aries_h_card | 夢魘艾里厄斯卡片 | 1 | md_aries_h | N | Y |
| 51 | as_bdy_knight_card | 不滅的被詛咒的騎士卡片 | 0 | - | N | Y |
| 52 | as_ragged_golem_card | 史蒂芬傑克厄尼斯特狼卡片 | 1 | as_ragged_golem | N | Y |
| 53 | as_wind_ghost_card | 不滅的風魔巫師卡片 | 0 | - | N | Y |
| 54 | assistant_card | 研究助理機器人卡片 | 1 | md_assistant | N | Y |
| 55 | assistant_h_card | 夢魘研究助理機器人卡片 | 1 | md_assistant_h | N | Y |
| 56 | attendance_card | 出席卡 | 0 | - | N | Y |
| 57 | aunoe_card | 阿烏奴艾卡片 | 0 | - | N | Y |
| 58 | awakenktullanux_card | 甦醒寒冰龍卡片 | 1 | ill_ktullanux | N | Y |
| 59 | b_eremes_card | 闇●十字刺客 艾勒梅斯卡片 | 2 | b_eremes,e_b_eremes | N | Y |
| 60 | b_hallucigenia_card | 小怪誕蟲卡片 | 0 | - | N | Y |
| 61 | b_harword_card | 闇●神工匠 哈沃得卡片 | 2 | b_harword,e_b_harword | N | Y |
| 62 | b_katrinn_card | 闇●超魔導師 凱特莉娜卡片 | 1 | b_katrinn | N | Y |
| 63 | b_magaleta_card | 闇●神官 瑪嘉雷特卡片 | 1 | b_magaleta | N | Y |
| 64 | b_scissore_ng_h_card | 夢魘故障的園丁β卡片 | 1 | md_beta_scissore_ng_h | N | Y |
| 65 | b_seyren_card | 闇●騎士領主 賽依連卡片 | 1 | b_seyren | N | Y |
| 66 | b_shecil_card | 闇●神射手 迪文卡片 | 1 | b_shecil | N | Y |
| 67 | bacsojin_card | 白素貞卡片 | 1 | bacsojin_ | N | Y |
| 68 | bakonawa_card | 食月暴龍卡片 | 4 | bakonawa_1,bakonawa_2 | N | Y |
| 69 | banaspaty_card | 巴拿斯帕堤卡片 | 2 | banaspaty,c2_banaspaty | N | Y |
| 70 | bangungot_card | 噩夢死神卡片 | 3 | bangungot_1,bangungot_2 | N | Y |
| 71 | banshee_master_card | 女妖首領卡片 | 1 | c5_banshee_master | N | Y |
| 72 | basilisk1_card | 偵查巴西利斯克卡片 | 1 | dr_basilisk1 | N | Y |
| 73 | basilisk2_card | 突擊巴西利斯克卡片 | 2 | dr_basilisk2,dr_basilisk3 | N | Y |
| 74 | bath_mermaid_card | 青琴公主卡片 | 1 | ep17_2_bath_mermaid | N | Y |
| 75 | beholder_master_card | 大眼怪首領卡片 | 0 | - | N | Y |
| 76 | bellare3_card | 精英貝拉雷卡片 | 1 | ep17_2_bellare3 | N | Y |
| 77 | bellare_card | 貝拉雷卡片 | 2 | md_a013_bellare,ep17_1_bellare1 | N | Y |
| 78 | berzebub_card | 貝雷傑卡片 | 1 | beelzebub_ | N | Y |
| 79 | beta_baths_a_card | 桑拿經理卡片 | 2 | ep17_2_beta_baths_a,ep17_2_beta_baths_b | N | Y |
| 80 | beta_cleaner_card | 故障的搓澡師卡片 | 2 | ep17_2_beta_cleaner_a,ep17_2_beta_cleaner_b | N | Y |
| 81 | beta_guards_ng_card | 故障的警衛型機器人β卡片 | 1 | ep17_2_beta_guards_ng | N | Y |
| 82 | beta_scissore_ng_card | 故障的園丁β卡片 | 1 | md_beta_scissore_ng | N | Y |
| 83 | big_bell_card | 大鐘怪卡片 | 1 | big_bell | N | Y |
| 84 | big_ben_card | 大笨鐘卡片 | 1 | big_ben | N | Y |
| 85 | big_eggring_card | 巨型蛋黃波利卡片 | 1 | dr_big_eggring | N | Y |
| 86 | bijou_card | 畢尤卡片 | 1 | bijou | N | Y |
| 87 | bitter_sohee_card | 憤懣鬼女卡片 | 1 | ill_sohee | N | Y |
| 88 | bitterarchersk_card | 憤懣邪骸弓箭手卡片 | 1 | ill_archer_skeleton | N | Y |
| 89 | bitterbongun_card | 憤懣妖道卡片 | 1 | ill_bon_gun | N | Y |
| 90 | bittermunak_card | 憤懣殭屍卡片 | 1 | ill_munak | N | Y |
| 91 | bittersohee_card | 憤懣鬼女卡片 | 0 | - | N | Y |
| 92 | black_coelacanth_card | 黑暗腔棘魚卡片 | 1 | coelacanth_n_a | N | Y |
| 93 | black_key_card | 黑色鑰匙卡片 | 0 | - | N | Y |
| 94 | blank_card | Blank Card | 0 | - | N | Y |
| 95 | bloody_knight_card | 血腥騎士卡片 | 1 | bloody_knight | N | Y |
| 96 | bloody_murderer_card | 嗜血怪人卡片 | 1 | bloody_murderer | N | Y |
| 97 | blue_key_card | 藍色鑰匙卡片 | 0 | - | N | Y |
| 98 | bluemoon_loli_ruri_card | 藍月魔女卡片 | 1 | bluemoon_loli_ruri | N | Y |
| 99 | blut_hase_card | 布魯德哈載卡片 | 1 | geffen_mage_6 | N | Y |
| 100 | bomi_card | 普美卡片 | 1 | ill_bomi | N | Y |
| 101 | bone_acidus_card | 骷髏俄希托斯卡片 | 0 | - | N | Y |
| 102 | bone_detale_card | 骷髏迪塔勒泰晤勒斯卡片 | 0 | - | N | Y |
| 103 | bone_ferus_card | 骷髏貝勒斯卡片 | 0 | - | N | Y |
| 104 | book_of_death_card | 亡靈魔書卡片 | 0 | - | N | Y |
| 105 | bookworm_card | 書蟲卡片 | 1 | ep17_2_bookworm | N | Y |
| 106 | bow_guardian_card | 機械狙擊手卡片 | 0 | - | N | Y |
| 107 | brinaranea_card | 巴利納拉雷亞卡片 | 1 | mm_brinaranea | N | Y |
| 108 | broken_thanatos_card | 破損的達納托斯的記憶卡片 | 0 | - | N | Y |
| 109 | brutal_murderer_card | 殘暴怪人卡片 | 1 | brutal_murderer | N | Y |
| 110 | bungisngis_card | 獨眼怪卡片 | 1 | bungisngis | N | Y |
| 111 | butoijo_card | 布托異竺卡片 | 1 | butoijo | N | Y |
| 112 | buwaya_card | 寶箱巨鱷卡片 | 1 | buwaya | N | Y |
| 113 | c_amdarais_card | 闇答萊屍幻影卡片 | 0 | - | N | Y |
| 114 | c_corruption_root_card | 無限墮落根莖卡片 | 0 | - | N | Y |
| 115 | c_corruptionroot_card | 無限墮落根莖卡片 | 0 | - | N | Y |
| 116 | c_himel_card | 希梅爾茲幻影卡片 | 0 | - | N | Y |
| 117 | c_khaliz_knight_card | 變異卡利斯格卡片 | 0 | - | N | Y |
| 118 | c_raydric_archer_card | 詛咒幽靈弓箭手卡片 | 0 | - | N | Y |
| 119 | c_raydric_card | 詛咒幽靈劍士卡片 | 0 | - | N | Y |
| 120 | c_white_knight_card | 變異白色騎士卡片 | 0 | - | N | Y |
| 121 | calmaring_card | 克拉波利卡片 | 0 | - | N | Y |
| 122 | cap_of_g_ship_card | Captain of Ghost Ship Card | 0 | - | N | Y |
| 123 | caput_card | 雙頭卡夫特卡片 | 2 | md_a013_caput,ep17_1_twin_caput1 | N | Y |
| 124 | caterpillar_card | 狂暴綠棉蟲卡片 | 2 | caterpillar,c4_caterpillar | N | Y |
| 125 | catherine_card | 凱薩琳卡片 | 0 | - | N | Y |
| 126 | cave_calmaring_card | 洞穴克拉波利卡片 | 0 | - | N | Y |
| 127 | cave_un_flower_card | 洞穴燈籠魚卡片 | 0 | - | N | Y |
| 128 | cenere_card | 惡靈之霧卡片 | 1 | cenere | N | Y |
| 129 | champion_card | 闇●武術宗師 陳理歐卡片 | 0 | - | N | Y |
| 130 | change_gender_card | Gender Change Card | 0 | - | N | Y |
| 131 | change_name_card | 角色改名卡 | 0 | - | N | Y |
| 132 | change_slot_card | 角色欄位變更卡 | 0 | - | N | Y |
| 133 | chaos_acolyte_card | 混沌服事卡片 | 0 | - | N | Y |
| 134 | chaos_ba_jr_card | 混沌小巴風特卡片 | 0 | - | N | Y |
| 135 | chaos_baphomet_card | 混沌巴風特卡片 | 0 | - | N | Y |
| 136 | chaos_goring_card | 混沌幽靈波利卡片 | 0 | - | N | Y |
| 137 | chaos_h_fly_card | 混沌赤蒼蠅卡片 | 0 | - | N | Y |
| 138 | chaos_k_mantis_card | 混沌狂暴螳螂卡片 | 0 | - | N | Y |
| 139 | chaos_mantis_card | 混沌螳螂卡片 | 0 | - | N | Y |
| 140 | chaos_poporing_card | 混沌波波利卡片 | 0 | - | N | Y |
| 141 | chaos_s_winder_card | 混沌黑蛇卡片 | 0 | - | N | Y |
| 142 | chaos_stem_w_card | 混沌灰森靈卡片 | 0 | - | N | Y |
| 143 | charleston_card | 查爾斯頓卡片 | 1 | charleston3 | N | Y |
| 144 | charslot_open_card | Character Slot Expansion Card | 0 | - | N | Y |
| 145 | chung_e_card | 小青卡片 | 1 | chung_e_ | N | Y |
| 146 | civil_servant_card | 狐仙卡片 | 1 | civil_servant | N | Y |
| 147 | clb_cp_pd_card | Kung Fu Panda Card | 0 | - | N | Y |
| 148 | clb_ss_ll_card | A-Ji and Geffen Card | 0 | - | N | Y |
| 149 | clb_ss_lt_card | Tai-Zi and Niflheim Card | 0 | - | N | Y |
| 150 | cliolima_card | Cliolima Card | 0 | - | N | Y |
| 151 | clown_card | 闇●搞笑藝人 雅歐帕奇爾卡片 | 1 | b_alphoccio | N | Y |
| 152 | cobalt_mineral_card | 鈷礦石魔卡片 | 0 | - | N | Y |
| 153 | coke_membership_card | Christmas Recipe | 0 | - | N | Y |
| 154 | colorful_t_bear_card | 多彩泰迪熊卡片 | 5 | ill_teddy_bear_r,ill_teddy_bear_y | N | Y |
| 155 | comp_kafra_card | [非賣品]隨地倉庫使用券 | 0 | - | N | Y |
| 156 | copo_card | Copo Card | 0 | - | N | Y |
| 157 | corruptionroot_card | 墮落根莖卡片 | 0 | - | N | Y |
| 158 | corruptionrooth_card | 覺醒墮落根莖卡片 | 0 | - | N | Y |
| 159 | cowraiders1_card | 霰彈槍草寇卡片 | 1 | cowraiders1 | N | Y |
| 160 | cowraiders2_card | 左輪手槍草寇卡片 | 1 | cowraiders2 | N | Y |
| 161 | cowraiders3_card | 彎刀草寇卡片 | 1 | cowraiders3 | N | Y |
| 162 | coyote_card | 郊狼卡片 | 1 | coyote | N | Y |
| 163 | creator_card | 闇●創造者 普拉梅姆卡片 | 0 | - | N | Y |
| 164 | cremy_fear_card | 狂暴克瑞米卡片 | 1 | cremy_fear | N | Y |
| 165 | crow_baron_card | 鴉魔男爵卡片 | 0 | - | N | Y |
| 166 | crow_duke_card | 鴉魔首領卡片 | 0 | - | N | Y |
| 167 | cruel_coelacanth_card | 暴力腔棘魚卡片 | 1 | coelacanth_h_a | N | Y |
| 168 | crux_card | 克魯斯卡片 | 0 | - | N | Y |
| 169 | cutie_card | 小可愛卡片 | 1 | ep16_2_mm_cutie | N | Y |
| 170 | daehyon_card | 將軍大賢卡片 | 1 | daehyon | N | Y |
| 171 | dancing_dragon_card | 舞獅卡片 | 2 | dancing_dragon,c5_dancing_dragon | N | Y |
| 172 | dark_shadow_card | 黑影幽靈卡片 | 1 | dark_shadow | N | Y |
| 173 | deadre_card | 戴德雷卡片 | 1 | deadre | N | Y |
| 174 | death_witch_card | 死亡女巫卡片 | 1 | death_witch | N | Y |
| 175 | deleter_card | 七彩地龍卡片 | 1 | deleter_ | N | Y |
| 176 | demigod_lasgand_card | Ultimate Lasgand Card | 0 | - | N | Y |
| 177 | despair_god_morocc_card | 絕望之神夢羅克卡片 | 1 | mm_morocc_adt | N | Y |
| 178 | despairgodmorocc_card | 絕望之神夢羅克卡片 | 0 | - | N | Y |
| 179 | deviling_card | 惡魔波利卡片 | 1 | deviling | N | Y |
| 180 | df_kafra_card | 隨身倉庫使用券[轉蛋專用] | 0 | - | N | Y |
| 181 | diego_card | 迪亞哥卡片 | 0 | - | N | Y |
| 182 | dio_anemos_card | 狄歐艾瑞默司卡片 | 1 | geffen_mage_2 | N | Y |
| 183 | discarded_l_r_card | 廢棄的中級蠕蟲卡片 | 0 | - | N | Y |
| 184 | discarded_p_r_card | 廢棄的原始蠕蟲卡片 | 0 | - | N | Y |
| 185 | disguiser_card | 小丑假面鬼卡片 | 1 | disguiser | N | Y |
| 186 | dispol_card | Dispol Card | 0 | - | N | Y |
| 187 | dolor3_card | 魔癮朵洛爾卡片 | 1 | ep17_2_dolor3 | N | Y |
| 188 | dolor_card | 朵洛爾卡片 | 2 | md_a013_dolor,ep17_1_dolor1 | N | Y |
| 189 | dolorian_card | 朵洛里安卡片 | 1 | dolorian | N | Y |
| 190 | donation_card | 捐款證明書 | 0 | - | N | Y |
| 191 | dr815_card | DR815卡片 | 1 | dr815 | N | Y |
| 192 | draco_card | 飛龍卡片 | 2 | draco,c2_draco | N | Y |
| 193 | dragon_zilant_card | 古龍ジラントカード | 0 | - | N | Y |
| 194 | dry_rafflesia_card | 幹扁草精卡片 | 1 | md_dry_rafflesia | N | Y |
| 195 | dry_rafflesia_h_card | 夢魘幹扁草精卡片 | 1 | md_dry_rafflesia_h | N | Y |
| 196 | dy_card | 狄瓦伊卡片 | 1 | geffen_mage_12 | N | Y |
| 197 | e_charslot_open_card | [Not for sale] Character Slot Expansion Card | 0 | - | N | Y |
| 198 | e_cowraiders1_card | 精英霰彈槍草寇卡片 | 1 | e_cowraiders1 | N | Y |
| 199 | e_cowraiders2_card | 精英左輪手槍草寇卡片 | 1 | e_cowraiders2 | N | Y |
| 200 | e_cowraiders3_card | 精英彎刀草寇卡片 | 1 | e_cowraiders3 | N | Y |
| 201 | e_ea1l_card | E-EA1L卡片 | 1 | md_e_ea1l | N | Y |
| 202 | e_ea2s_card | E-EA2S卡片 | 1 | md_e_ea2s | N | Y |
| 203 | e_inter_rgan_card | 蜷曲的中級蠕蟲卡片 | 0 | - | N | Y |
| 204 | e_rgan_cleaner_card | Jormungandr Sanctuary Cleaner Card | 0 | - | N | Y |
| 205 | e_rgan_guardian_card | Jormungandr Sanctuary Guardian Card | 0 | - | N | Y |
| 206 | e_rgan_healer_card | Jormungandr Church Bishop Card | 0 | - | N | Y |
| 207 | e_rgan_warlock_card | Jormungandr Church Warlock Card | 0 | - | N | Y |
| 208 | egg_of_draco_card | 飛龍蛋卡片 | 0 | - | N | Y |
| 209 | el_a17t_card | EL-A17T卡片 | 1 | md_el_a17t | N | Y |
| 210 | eldest_card | 千年老妖卡片 | 0 | - | N | Y |
| 211 | elena_card | 埃琳娜卡片 | 0 | - | N | Y |
| 212 | elvira_card | 埃維亞卡片 | 1 | elvira | N | Y |
| 213 | empathizer_card | 體諒墮天使卡片 | 0 | - | N | Y |
| 214 | encroached_tan_card | Encroached Tan Card | 0 | - | N | Y |
| 215 | engkanto_card | 昂坎圖卡片 | 1 | engkanto | N | Y |
| 216 | ep17_2_cramp_card | 下水道藍鼠卡片 | 1 | ep17_2_cramp | N | Y |
| 217 | ep17_2_marc_card | 熱池馬克卡片 | 1 | ep17_2_marc | N | Y |
| 218 | ep17_2_phen_card | 熱池劍魚卡片 | 1 | ep17_2_phen | N | Y |
| 219 | ep17_2_piranha_card | 熱池食人魚卡片 | 1 | ep17_2_piranha | N | Y |
| 220 | ep17_2_sword_fish_card | 熱池異變魚卡片 | 1 | ep17_2_sword_fish | N | Y |
| 221 | ep18_ash_toad_card | 灰燼蟾蜍卡片 | 1 | ep18_ash_toad | N | Y |
| 222 | ep18_ashhopper_card | 灰燼蝗蟲卡片 | 1 | ep18_ashhopper | N | Y |
| 223 | ep18_ashring_card | 灰燼波利卡片 | 1 | ep18_ashring | N | Y |
| 224 | ep18_burning_fang_card | 火焰狼牙卡片 | 0 | - | N | Y |
| 225 | ep18_demi_freyja_card | 扭曲之神卡片 | 3 | ep18_md_demi_freyja,ep18_md_demi_freyja_r | N | Y |
| 226 | ep18_firewind_kite_card | 風火老鷹卡片 | 1 | ep18_firewind_kite | N | Y |
| 227 | ep18_grey_wolf_card | 灰狼卡片 | 1 | ep18_grey_wolf | N | Y |
| 228 | ep18_hot_molar_card | 火爪狼牙卡片 | 1 | ep18_hot_molar | N | Y |
| 229 | ep18_lava_toad_card | 熔巖蟾蜍卡片 | 1 | ep18_lava_toad | N | Y |
| 230 | ep18_phantom_wolf_card | 幽靈灰狼卡片 | 1 | ep18_phantom_wolf | N | Y |
| 231 | ep18_rakehand_card | 幽靈之爪卡片 | 1 | ep18_rakehand | N | Y |
| 232 | ep18_schulang_card | 舒朗卡片 | 3 | ep18_md_schulang,ep18_md_schulang_r | N | Y |
| 233 | ep18_spark_card | 幽靈火花卡片 | 1 | ep18_spark | N | Y |
| 234 | ep18_tumble_ring_card | 風滾草波利卡片 | 1 | ep18_tumble_ring | N | Y |
| 235 | ep18_volcaring_card | 熔巖波利卡片 | 1 | ep18_volcaring | N | Y |
| 236 | erzsebet_card | 伊莉莎白卡片 | 0 | - | N | Y |
| 237 | est_card | 艾絲特卡片 | 0 | - | N | Y |
| 238 | evil_card | 邪心獵人伊芙卡片 | 1 | ep16_2_h_hunter_ev | N | Y |
| 239 | evil_cloud_hermit_card | 惡雲仙人卡片 | 1 | evil_cloud_hermit | N | Y |
| 240 | evil_fanatics_card | 魔神追隨者卡片 | 1 | mm_evil_fanatics | N | Y |
| 241 | evil_shadow_card | 魔神影子卡片 | 3 | mm_evil_shadow1,mm_evil_shadow2 | N | Y |
| 242 | executioner_card | 行刑者卡片 | 0 | - | N | Y |
| 243 | exploration_rover_t_card | 探索機器人卡片 | 1 | exploration_rover_t | N | Y |
| 244 | explorationrover_t_card | 探索機器人卡片 | 0 | - | N | Y |
| 245 | eyes_dollocaris_card | 雙眼多洛蝦卡片 | 0 | - | N | Y |
| 246 | f_angel_iceslug_card | Fallen Angel Slug Card | 0 | - | N | Y |
| 247 | faceworm_card | 驚駭森靈卡片 | 1 | faceworm | N | Y |
| 248 | faceworm_d_card | 暗黑驚駭森靈卡片 | 1 | faceworm_dark | N | Y |
| 249 | faceworm_egg_card | 驚駭森靈卵卡片 | 1 | faceworm_egg | N | Y |
| 250 | faceworm_l_card | 驚駭森靈幼蟲卡片 | 1 | faceworm_larva | N | Y |
| 251 | faceworm_q_card | 驚駭森靈皇后卡片 | 5 | faceworm_queen,faceworm_queen_r | N | Y |
| 252 | faithful_manager_card | 頑靈惡童卡片 | 1 | faithful_manager | N | Y |
| 253 | faithfulmanager_card | 頑靈惡童卡片 | 0 | - | N | Y |
| 254 | fake_iwin_s_card | Suspicious Iwin Soldier Card | 0 | - | N | Y |
| 255 | fancy_key_card | 華麗的鑰匙卡片 | 0 | - | N | Y |
| 256 | fei_kanabian_card | 培坎納比恩卡片 | 1 | fei_kanabian | N | Y |
| 257 | felock_card | 船長裴陸卡片 | 1 | e1_felock | N | Y |
| 258 | ferus_p_card | 紫色貝勒斯卡片 | 0 | - | N | Y |
| 259 | fillia_card | 變異菲利亞凱美拉卡片 | 1 | chimera_fillia | N | Y |
| 260 | fire_golem_card | 火焰巨石怪卡片 | 1 | fire_golem | N | Y |
| 261 | firm_blazzer_card | 堅硬火焰妖卡片 | 1 | blazzer_h | N | Y |
| 262 | firm_deleter1_card | 堅硬七彩地龍卡片 | 1 | deleter2_h | N | Y |
| 263 | firm_deleter2_card | 堅硬七彩飛龍卡片 | 1 | deleter1_h | N | Y |
| 264 | firm_explosion_card | 堅硬爆炎蝙蝠卡片 | 1 | explosion_h | N | Y |
| 265 | firm_kaho_card | 堅硬卡浩卡片 | 1 | kaho_h | N | Y |
| 266 | firm_lava_g_card | 堅硬熔巖巨石卡片 | 1 | lava_golem_h | N | Y |
| 267 | firm_muspell_card | 堅硬穆希貝斯寇卡片 | 1 | muspellskoll_h | N | Y |
| 268 | firm_nightmare_t_card | 堅硬七彩夢魘卡片 | 1 | nightmare_terror_h | N | Y |
| 269 | flame_ghost_card | 火魔巫師卡片 | 1 | flame_ghost_h | N | Y |
| 270 | fragment_of_soul_card | 靈魂碎片卡片 | 1 | ill_mineral | N | Y |
| 271 | friedrich_card | 弗里德里希卡片 | 0 | - | N | Y |
| 272 | frozen_gargoyle_card | 冰凍蝙蝠弓箭手卡片 | 1 | gargoyle_h | N | Y |
| 273 | frozenwolf_card | 極凍戰狼卡片 | 1 | frozenwolf | N | Y |
| 274 | fru_pom_spider_card | 果實食人蜘蛛卡片 | 1 | dr_pom_spider | N | Y |
| 275 | fulbuk_card | 火蟻卡片 | 0 | - | N | Y |
| 276 | fulgor_card | 變異獨角光輝凱美拉卡片 | 1 | chimera_fulgor | N | Y |
| 277 | furyhero_card | 狂熱英雄卡片 | 1 | ill_fury_hero | N | Y |
| 278 | gajomart_card | 狂暴鬼火卡片 | 1 | gajomart | N | Y |
| 279 | galensis_card | 變異凱倫西斯凱美拉卡片 | 1 | chimera_galensis | N | Y |
| 280 | gan_ceann_card | 無顱遊魂卡片 | 1 | gan_ceann | N | Y |
| 281 | gaster_card | 瓦斯特卡片 | 1 | gaster | N | Y |
| 282 | gc109_card | GC109卡片 | 1 | gc109 | N | Y |
| 283 | geffen_gang_card | 吉芬流氓卡片 | 1 | geffen_mage_3_3 | N | Y |
| 284 | geffen_thief_card | 吉芬小偷卡片 | 1 | geffen_mage_3_1 | N | Y |
| 285 | geffen_thug_card | 吉芬小混混卡片 | 1 | geffen_mage_3_2 | N | Y |
| 286 | general_orc_card | 獸人將軍卡片 | 0 | - | N | Y |
| 287 | genetic_card | 闇·基因學者 普拉梅姆卡片 | 1 | v_b_flamel | N | Y |
| 288 | ghost_cube_card | 幽靈魔卡片 | 1 | ghost_cube | N | Y |
| 289 | giant_caput_card | 巨型卡夫特卡片 | 1 | giant_caput | N | Y |
| 290 | giant_honet_card | 狂暴蜂兵卡片 | 2 | giant_honet,c3_giant_honet | N | Y |
| 291 | giant_spider_card | 狂暴蜘蛛卡片 | 1 | giant_spider | N | Y |
| 292 | gigantes_card | 基勘特斯卡片 | 6 | mm_m_gigan1,mm_m_gigan2 | N | Y |
| 293 | gioia_card | 喬伊亞卡片 | 1 | gioia | N | Y |
| 294 | goblin_king_card | 國王哥布靈卡片 | 0 | - | N | Y |
| 295 | gold_card | 金色卡片 | 0 | - | N | Y |
| 296 | gold_q_scaraba_card | 黃金女王甲蟲卡片 | 0 | - | N | Y |
| 297 | gold_scaraba_card | 黃金甲蟲卡片 | 0 | - | N | Y |
| 298 | golden_card | 黃金卡冊 | 0 | - | N | Y |
| 299 | gony_card | 高尼卡片 | 0 | - | N | Y |
| 300 | gopinich_card | 青冠龍卡片 | 0 | - | N | Y |
| 301 | gran_papilia_card | 格蘭帕皮利亞卡片 | 1 | md_gran_papilia | N | Y |
| 302 | grand_pere_card | 覺醒貝爾卡片 | 1 | grand_pere | N | Y |
| 303 | grave_a_mummy_card | 滅絕狂暴木乃伊卡片 | 1 | n_ancient_mummy | N | Y |
| 304 | grave_amon_ra_card | 滅絕古埃及王卡片 | 1 | n_amon_ra | N | Y |
| 305 | grave_arclouse_card | 滅絕卷甲蟲卡片 | 1 | n_arclouse | N | Y |
| 306 | grave_mimic_card | 滅絕邪惡箱卡片 | 1 | n_mimic | N | Y |
| 307 | grave_minorous_card | 滅絕米洛斯卡片 | 1 | n_minorous | N | Y |
| 308 | grave_mummy_card | 滅絕木乃伊卡片 | 1 | n_mummy | N | Y |
| 309 | grave_verit_card | 滅絕木乃伊犬卡片 | 1 | n_verit | N | Y |
| 310 | green_cenere_card | 綠惡靈之霧卡片 | 1 | cenere_g | N | Y |
| 311 | green_key_card | 綠色的鑰匙卡片 | 0 | - | N | Y |
| 312 | greencenere_card | 綠惡靈之霧卡片 | 0 | - | N | Y |
| 313 | grey_icewind_card | Grey Icewind Card | 0 | - | N | Y |
| 314 | grote_card | 喜慶鬼娃樹卡片 | 1 | grote | N | Y |
| 315 | guillotinecross_card | 闇·十字切割者 艾勒梅斯卡片 | 1 | v_b_eremes | N | Y |
| 316 | gypsy_card | 闇●冷豔舞姬 特蘭提尼卡片 | 1 | b_trentini | N | Y |
| 317 | h_b_princess_meer_card | 半龍王女メアカード | 0 | - | N | Y |
| 318 | hallucigenia_card | 怪誕蟲卡片 | 0 | - | N | Y |
| 319 | happy_giver_card | 幸福墮天使卡片 | 0 | - | N | Y |
| 320 | heart_hunter_at_card | 邪心獵人AT卡片 | 0 | - | N | Y |
| 321 | heart_hunter_card | 邪心獵人卡片 | 4 | ep16_2_h_hunter_v,ep16_2_h_hunter_md | N | Y |
| 322 | heavy_metaling_card | 礦石波利卡片 | 0 | - | N | Y |
| 323 | hell_apocalips_card | 地獄機械戰士卡片 | 0 | - | N | Y |
| 324 | helmut_card | 赫爾穆特卡片 | 0 | - | N | Y |
| 325 | high_bellare_card | 高級貝拉雷卡片 | 1 | ep17_1_bellare2 | N | Y |
| 326 | high_sanare_card | 高級薩納雷卡片 | 1 | ep17_1_sanare2 | N | Y |
| 327 | holy_frus_card | 神聖彩色皮影魔卡片 | 0 | - | N | Y |
| 328 | holy_skogul_card | 神聖皮影魔卡片 | 0 | - | N | Y |
| 329 | horn_card | 鍬形蟲卡片 | 2 | c2_horn,horn | N | Y |
| 330 | human_kimera_card | 人型凱美拉卡片 | 1 | ep16_2_human_kimera | N | Y |
| 331 | hyegun_card | 妖君卡片 | 2 | hyegun,c3_hyegun | N | Y |
| 332 | hyper_death_card | 伊佛德斯卡片 | 1 | geffen_mage_8 | N | Y |
| 333 | ice_gangu_card | 冰鋒球卡片 | 0 | - | N | Y |
| 334 | ice_ghost_card | 冰魔巫師卡片 | 1 | ice_ghost_h | N | Y |
| 335 | ice_horn_card | Ice Horn Card | 0 | - | N | Y |
| 336 | ice_seahorse_card | Ice Seahorse Card | 0 | - | N | Y |
| 337 | ice_straw_card | 冰蛇鰻卡片 | 0 | - | N | Y |
| 338 | icebear_card | Bear Bug Card | 0 | - | N | Y |
| 339 | icewind_card | Icewind Card | 0 | - | N | Y |
| 340 | icewind_egg_card | Icewind Egg Card | 0 | - | N | Y |
| 341 | id_card | 實驗體識別手環 | 0 | - | N | Y |
| 342 | idtest_card | IDTest Card | 0 | - | N | Y |
| 343 | ifn_chimera_card | 無限凱美拉卡片 | 1 | min_chimera | N | Y |
| 344 | ifn_eclipse_card | 無限藍瘋兔卡片 | 1 | min_eclipse | N | Y |
| 345 | ifn_eddga_card | 無限虎王卡片 | 1 | min_eddga | N | Y |
| 346 | ifn_orchero_card | 無限獸人英雄卡片 | 1 | min_ork_hero | N | Y |
| 347 | ifn_osiris_card | 無限俄塞里斯卡片 | 1 | min_osiris | N | Y |
| 348 | ifn_phreeoni_card | 無限皮里恩卡片 | 1 | min_phreeoni | N | Y |
| 349 | ifn_tao_gunka_card | 無限塔奧群卡卡片 | 1 | min_tao_gunka | N | Y |
| 350 | ifn_v_wolf_card | 無限流浪之狼卡片 | 1 | min_vagabond_wolf | N | Y |
| 351 | ifn_vocal_card | 無限蝗蟲之王卡片 | 1 | min_vocal | N | Y |
| 352 | ill_abysmal_witch_card | 深海魔女卡片 | 1 | ill_abysmal_witch | N | Y |
| 353 | ill_andre_card | 勤奮的白蟻卡片 | 1 | ill_andre | N | Y |
| 354 | ill_andre_larva_card | 勤奮的白蟻幼蟲卡片 | 1 | ill_andre_larva | N | Y |
| 355 | ill_andre_soldier_card | 勤奮的士兵白蟻卡片 | 1 | ill_soldier_andr | N | Y |
| 356 | ill_ant_egg_card | 粘稠的白蟻幼蟲卡片 | 1 | ill_ant_egg | N | Y |
| 357 | ill_deniro_card | 勤奮的兵蟻卡片 | 1 | ill_deniro | N | Y |
| 358 | ill_deviace_card | 深海狄奧斯卡片 | 1 | ill_deviace | N | Y |
| 359 | ill_dracula_card | 憤怒德古拉伯爵卡片 | 1 | ill_dracula | N | Y |
| 360 | ill_farmiliar_card | 膽大的吸血蝙蝠卡片 | 1 | ill_farmiliar | N | Y |
| 361 | ill_giearth_card | 膽大的基爾瑟卡片 | 1 | ill_giearth | N | Y |
| 362 | ill_king_dramoh_card | 深海大腳龍蝦卡片 | 1 | ill_king_dramoh | N | Y |
| 363 | ill_kraken_card | 深海魔鬼大烏賊卡片 | 1 | ill_kraken | N | Y |
| 364 | ill_marse_card | 深海烏賊卡片 | 1 | ill_marse | N | Y |
| 365 | ill_maya_card | 寡言的蟻后卡片 | 1 | ill_maya | N | Y |
| 366 | ill_merman_card | 深海人魚士兵卡片 | 1 | ill_merman | N | Y |
| 367 | ill_obeaune_card | 深海人魚卡片 | 1 | ill_obeaune | N | Y |
| 368 | ill_phen_card | 深海劍魚卡片 | 1 | ill_phen | N | Y |
| 369 | ill_piere_card | 勤奮的工蟻卡片 | 1 | ill_piere | N | Y |
| 370 | ill_sedora_card | 深海賽杜拉卡片 | 1 | ill_sedora | N | Y |
| 371 | ill_sropho_card | 幻影深海電鰻卡片 | 1 | ill_sropho | N | Y |
| 372 | ill_strouf_card | 深海海神卡片 | 1 | ill_strouf | N | Y |
| 373 | ill_sword_fish_card | 深海異變魚卡片 | 1 | ill_sword_fish | N | Y |
| 374 | ill_vitata_card | 勤奮的黑蟻卡片 | 1 | ill_vitata | N | Y |
| 375 | immotal_corps_card | 不死軍團卡片 | 5 | immotal_corps,immortal_corps1 | N | Y |
| 376 | incant_samurai_card | 元靈武士卡片 | 1 | incantation_samurai | N | Y |
| 377 | ingrid_card | 英格麗卡片 | 0 | - | N | Y |
| 378 | irene_elder_card | 艾琳長老卡片 | 1 | irene_elder | N | Y |
| 379 | iron_fist_card | 鐵蠍卡片 | 1 | iron_fist | N | Y |
| 380 | isaac_card | 艾薩克卡片 | 0 | - | N | Y |
| 381 | jakudam_card | 扎庫坦卡片 | 1 | c5_zakudam | N | Y |
| 382 | jejeling_card | 食人波利卡片 | 1 | jejeling | N | Y |
| 383 | jeniffer_card | 珍妮佛卡片 | 0 | - | N | Y |
| 384 | jew_card | 朱朱卡片 | 1 | geffen_mage_11 | N | Y |
| 385 | jeweliant_card | 珠寶蜘蛛卡片 | 2 | jeweliant,g_jeweliant | N | Y |
| 386 | jitterbug_card | 吉特巴卡片 | 2 | jitterbug1,jitterbug2 | N | Y |
| 387 | jormun_guardian_card | Jormungandr Guardian Card | 0 | - | N | Y |
| 388 | ju_mandragora_card | 叢林曼陀羅魔花卡片 | 1 | dr_mandragora | N | Y |
| 389 | jungoliant_card | 珠寶溫古力安特卡片 | 1 | jungoliant | N | Y |
| 390 | junior_rgan_card | 下級蠕蟲卡片 | 0 | - | N | Y |
| 391 | jurgen_card | 尤勒基恩卡片 | 0 | - | N | Y |
| 392 | kades_card | 亡靈的守護者卡德斯卡片 | 1 | kades | N | Y |
| 393 | kafra_card | 隨身倉庫使用券 | 0 | - | N | Y |
| 394 | kathryn_card | 卡特琳卡片 | 0 | - | N | Y |
| 395 | khaliz_knightage_card | 卡利斯格騎士團卡片 | 0 | - | N | Y |
| 396 | kick_and_kick_card | 霹靂機器人卡片 | 1 | kick_and_kick | N | Y |
| 397 | kick_step_card | 智能變異晶片卡片 | 1 | kick_step | N | Y |
| 398 | kickandkick_card | 霹靂機器人卡片 | 0 | - | N | Y |
| 399 | kiel_card | 基爾-D-01卡片 | 1 | kiel_ | N | Y |
| 400 | knight_sakray_card | 騎士薩克萊卡片 | 0 | - | N | Y |
| 401 | kronecker_card | 克羅內克爾卡片 | 0 | - | N | Y |
| 402 | ktullanux_card | 寒冰龍卡片 | 1 | e_ktullanux | N | Y |
| 403 | kuro_akuma_card | 庫洛雅庫瑪卡片 | 1 | geffen_mage_7 | N | Y |
| 404 | l_agnes_card | アグネス・レベンブルグ(サイン入り)カード | 0 | - | N | Y |
| 405 | l_catherine_card | キャサリン・ゲオルグ(サイン入り)カード | 0 | - | N | Y |
| 406 | l_friedrich_card | フリードリヒ・ハイネン(サイン入り)カード | 0 | - | N | Y |
| 407 | l_issac_card | アイザック・ウィグナー(サイン入り)カード | 0 | - | N | Y |
| 408 | l_kronecker_card | クロネカー・ハイネン(サイン入り)カード | 0 | - | N | Y |
| 409 | labyrinth_bapho_card | Labyrinth Baphomet Card | 0 | - | N | Y |
| 410 | labyrinth_berzebub_card | 迷宮のヴェルゼブブカード | 0 | - | N | Y |
| 411 | labyrinth_dop_card | 迷宮のドッペルゲンガーカード | 0 | - | N | Y |
| 412 | labyrinth_dra_card | 迷宮のドラキュラカード | 0 | - | N | Y |
| 413 | lady_tanee_card | 嗒妮小姐卡片 | 1 | lady_tanee | N | Y |
| 414 | lava_eater_card | 變異熔巖凱美拉卡片 | 1 | chimera_lava | N | Y |
| 415 | leizi_card | 雷基卡片 | 0 | - | N | Y |
| 416 | les_card | 雷斯卡片 | 3 | empelium,g_marc | N | Y |
| 417 | letterster_card | Letterster Card | 0 | - | N | Y |
| 418 | lich_lord_card | 亡者之君主卡片 | 2 | md_lich_lord_100,md_lich_lord_160 | N | Y |
| 419 | lichternb_card | 元素鬼火(藍)卡片 | 1 | lichtern_b | N | Y |
| 420 | lichterng_card | 元素鬼火(褐)卡片 | 1 | lichtern_g | N | Y |
| 421 | lichternr_card | 元素鬼火(紅)卡片 | 1 | lichtern_r | N | Y |
| 422 | lichterny_card | 元素鬼火(綠)卡片 | 1 | lichtern_y | N | Y |
| 423 | limacina_card | 青翅巨鳥卡片 | 0 | - | N | Y |
| 424 | litus_card | 變異利圖斯凱美拉卡片 | 1 | chimera_litus | N | Y |
| 425 | living_dead_card | 活死人卡片 | 3 | ill_zombie_c,ill_zombie | N | Y |
| 426 | livingdead_card | 活死人卡片 | 0 | - | N | Y |
| 427 | livingdeath_card | 墮落生命卡片 | 0 | - | N | Y |
| 428 | lmtd_diego_card | 限量迪亞哥卡片 | 0 | - | N | Y |
| 429 | lmtd_manny_card | 限量蠻尼卡片 | 0 | - | N | Y |
| 430 | lmtd_scrat_card | 限量鼠奎特卡片 | 0 | - | N | Y |
| 431 | lmtd_sid_card | 限量喜德卡片 | 0 | - | N | Y |
| 432 | loli_ruri_card | 銀月魔女卡片 | 2 | loli_ruri,c1_loli_ruri | N | Y |
| 433 | lookie_card | 小蟲卡片 | 0 | - | N | Y |
| 434 | lora_card | 女戰士蘿拉卡片 | 3 | g_zombie,g_poison_spore | N | Y |
| 435 | lord_of_death_card | 死靈騎士卡片 | 0 | - | N | Y |
| 436 | lova_bahamut_card | [LoVA] バハムートカード | 0 | - | N | Y |
| 437 | lova_r_bahamut_card | [LoVA] 真化バハムートカード | 0 | - | N | Y |
| 438 | lova_r_ragnarok_card | [LoVA] 真化ラグナロクカード | 0 | - | N | Y |
| 439 | lova_ragnarok_card | [LoVA] ラグナロクカード | 0 | - | N | Y |
| 440 | lowest_rgan_card | 最下級蠕蟲卡片 | 0 | - | N | Y |
| 441 | lude_gal_card | 南瓜靈卡片 | 1 | lude_gal | N | Y |
| 442 | m_morocc_card | 魔神夢羅克卡片 | 0 | - | N | Y |
| 443 | manananggal_card | 瑪那能革卡片 | 1 | manananggal | N | Y |
| 444 | mangkukulam_card | 猛酷巫師卡片 | 1 | mangkukulam | N | Y |
| 445 | manny_card | 蠻尼卡片 | 0 | - | N | Y |
| 446 | mattdrainliar_card | 幻影紅蝙蝠卡片 | 0 | - | N | Y |
| 447 | matter_kimera_card | 物質型凱美拉卡片 | 1 | ep16_2_matter_kimera | N | Y |
| 448 | mavka_card | 森林妖精卡片 | 0 | - | N | Y |
| 449 | maya_puple_card | 狂暴蟻后卡片 | 1 | maya_puple | N | Y |
| 450 | md_airboat_card | 朽木卡片 | 0 | - | N | Y |
| 451 | md_geffen_akuma_card | 鬥技場庫洛雅庫瑪卡片 | 0 | - | N | Y |
| 452 | md_geffen_archi_card | 鬥技場雅樂西卡片 | 0 | - | N | Y |
| 453 | md_geffen_blut_card | 鬥技場布魯德哈載卡片 | 0 | - | N | Y |
| 454 | md_geffen_dio_card | 鬥技場狄歐艾瑞默司卡片 | 0 | - | N | Y |
| 455 | md_geffen_dy_card | 鬥技場狄瓦伊卡片 | 0 | - | N | Y |
| 456 | md_geffen_fei_card | 鬥技場培坎納比恩卡片 | 0 | - | N | Y |
| 457 | md_geffen_gang_card | 鬥技場流氓卡片 | 0 | - | N | Y |
| 458 | md_geffen_hyper_card | 鬥技場伊佛德斯卡片 | 0 | - | N | Y |
| 459 | md_geffen_jew_card | 鬥技場朱朱卡片 | 0 | - | N | Y |
| 460 | md_geffen_monk_card | 鬥技場沛蒙卡片 | 0 | - | N | Y |
| 461 | md_geffen_odorico_card | 鬥技場歐托莉柯卡片 | 0 | - | N | Y |
| 462 | md_geffen_ordre_card | 鬥技場奧樂德卡片 | 0 | - | N | Y |
| 463 | md_geffen_reche_card | 鬥技場萊採尼芮卡片 | 0 | - | N | Y |
| 464 | md_geffen_thief_card | 鬥技場小偷卡片 | 0 | - | N | Y |
| 465 | md_geffen_thug_card | 鬥技場小混混卡片 | 0 | - | N | Y |
| 466 | mechanic_card | 闇·機匠 哈沃得卡片 | 1 | v_b_harword | N | Y |
| 467 | mechaspider_card | 蜘蛛戰車卡片 | 1 | mechaspider | N | Y |
| 468 | melibe_iceslug_card | Melibe Slug Card | 0 | - | N | Y |
| 469 | menblatt_card | 花妖精卡片 | 1 | menblatt | N | Y |
| 470 | meyer_card | 邁耶卡片 | 0 | - | N | Y |
| 471 | middle_g_rgan_card | 中級蠕蟲卡片 | 0 | - | N | Y |
| 472 | miguel_card | 米古爾卡片 | 1 | md_miguel | N | Y |
| 473 | mini_octopus_card | 小章魚卡片 | 1 | md_octopus | N | Y |
| 474 | minionofmorocc_card | 夢羅克的行妖術者卡片 | 0 | - | N | Y |
| 475 | minstrel_card | 闇·宮廷樂師 雅歐帕奇爾卡片 | 1 | v_b_alphoccio | N | Y |
| 476 | mistress_card | 蜂后卡片 | 2 | mistress,e_mistress | N | Y |
| 477 | mt_caput_card | 變異雙頭卡夫特卡片 | 1 | ep17_1_twin_caput2 | N | Y |
| 478 | mt_dolor_card | 變異朵洛爾卡片 | 1 | ep17_1_dolor2 | N | Y |
| 479 | mt_venenum_card | 變異貝納姆卡片 | 1 | ep17_1_venenum2 | N | Y |
| 480 | muspellskoll_card | 穆希貝斯寇卡片 | 1 | mm_muspellskoll | N | Y |
| 481 | mutant_coelacanth_card | 變種腔棘魚卡片 | 1 | coelacanth_h_m | N | Y |
| 482 | mutant_plaga_card | 變異普拉加卡片 | 1 | ep17_1_plaga2 | N | Y |
| 483 | nahtzigger_card | 納戶特基格卡片 | 0 | - | N | Y |
| 484 | napeo_card | 變異納佩奧凱美拉卡片 | 1 | chimera_napeo | N | Y |
| 485 | neo_mineral_card | 霓虹礦石魔卡片 | 5 | g_mineral_g,mineral_g | N | Y |
| 486 | neo_punk_card | 惡靈朽魔卡片 | 1 | neo_punk | N | Y |
| 487 | nidhogg_shadow_card | 尼德霍格幻影卡片 | 0 | - | N | Y |
| 488 | nihil_card | 尼希爾卡片 | 0 | - | N | Y |
| 489 | novice_poring_card | 寶貝波利卡片 | 2 | little_poring,c3_little_poring | N | Y |
| 490 | o_cleaner_ng_card | 故障的掃地機器人Ω卡片 | 1 | ep17_2_omega_cleaner_ng | N | Y |
| 491 | odd_coelacanth_card | 古怪腔棘魚卡片 | 1 | coelacanth_n_m | N | Y |
| 492 | odorico_card | 歐托莉柯卡片 | 1 | geffen_mage_10 | N | Y |
| 493 | ominous_assulter_card | 不祥風靈龜卡片 | 1 | ill_assulter | N | Y |
| 494 | ominous_freezer_card | 不祥水靈龜卡片 | 1 | ill_freezer | N | Y |
| 495 | ominous_heater_card | 不祥火焰龜卡片 | 1 | ill_heater | N | Y |
| 496 | ominous_permeter_card | 不祥果樹龜卡片 | 1 | ill_permeter | N | Y |
| 497 | ominous_solider_card | 不祥巖石龜卡片 | 1 | ill_solider | N | Y |
| 498 | ominous_turtle_g_card | 不祥烏龜將軍卡片 | 1 | ill_turtle_general | N | Y |
| 499 | ominousassulter_card | 不祥風靈龜卡片 | 0 | - | N | Y |
| 500 | ominousfreezer_card | 不祥水靈龜卡片 | 0 | - | N | Y |
| 501 | ominousheater_card | 不祥火焰龜卡片 | 0 | - | N | Y |
| 502 | ominouspermeter_card | 不祥果樹龜卡片 | 0 | - | N | Y |
| 503 | ominoussolider_card | 不祥巖石龜卡片 | 0 | - | N | Y |
| 504 | ominousturtleg_card | 不祥烏龜將軍卡片 | 0 | - | N | Y |
| 505 | one_e_dollocaris_card | 獨眼多洛蝦卡片 | 0 | - | N | Y |
| 506 | ordre_card | 奧樂德卡片 | 1 | geffen_mage_5 | N | Y |
| 507 | owl_marquees_card | 鴞嫋侯爵卡片 | 1 | owl_marquees | N | Y |
| 508 | owl_viscount_card | 鴞嫋子爵卡片 | 1 | owl_viscount | N | Y |
| 509 | p_amdarais_card | 強化暗答萊屍卡片 | 1 | p_amdarais | N | Y |
| 510 | p_archer_skeleton_card | 強化邪骸弓箭手卡片 | 1 | p_archer_skeleton | N | Y |
| 511 | p_soldier_skeleton_card | 強化邪骸士兵卡片 | 1 | p_soldier_skeleton | N | Y |
| 512 | pa_monk_card | 沛蒙卡片 | 1 | geffen_mage_4 | N | Y |
| 513 | paladin_card | 闇●聖殿十字軍 蘭達卡片 | 0 | - | N | Y |
| 514 | panat_card | 法恩特卡片 | 0 | - | N | Y |
| 515 | papila_cae_card | 帕皮拉凱依卡片 | 1 | md_papila_cae | N | Y |
| 516 | papila_cae_h_card | 夢魘帕皮拉凱依卡片 | 1 | md_papila_cae_h | N | Y |
| 517 | papila_card | 帕皮拉卡片 | 1 | md_papila | N | Y |
| 518 | papila_h_card | 夢魘帕皮拉卡片 | 1 | md_papila_h | N | Y |
| 519 | papila_ruba_card | 帕皮拉盧巴卡片 | 1 | md_papila_ruba | N | Y |
| 520 | papila_ruba_h_card | 夢魘帕皮拉盧巴卡片 | 1 | md_papila_ruba_h | N | Y |
| 521 | parus_card | 惡魔啄木鳥卡片 | 1 | parus | N | Y |
| 522 | payon_soldier_card | 斐揚士兵卡片 | 2 | payonsoldier,payonsoldier2 | N | Y |
| 523 | petal_card | 花瓣怪蟲卡片 | 1 | petal | N | Y |
| 524 | phendark_card | 阿修羅狂戰士卡片 | 1 | phendark | N | Y |
| 525 | pierrotzoist_card | 小丑兔斯拉卡片 | 1 | pierrotzoist | N | Y |
| 526 | pillar_card | 費爾拉卡片 | 0 | - | N | Y |
| 527 | pitaya_b_card | 藍肉食人火龍果卡片 | 2 | ep17_2_pitaya_b,md_pitaya_b | N | Y |
| 528 | pitaya_boss_card | 大王喵喵卡片 | 2 | ep17_2_pitaya_boss,md_pitaya_boss | N | Y |
| 529 | pitaya_g_card | 綠肉食人火龍果卡片 | 2 | ep17_2_pitaya_g,md_pitaya_g | N | Y |
| 530 | pitaya_r_card | 紅肉食人火龍果卡片 | 2 | ep17_2_pitaya_r,md_pitaya_r | N | Y |
| 531 | pitaya_v_card | 紫肉食人火龍果卡片 | 2 | ep17_2_pitaya_v,md_pitaya_v | N | Y |
| 532 | pitaya_y_card | 黃肉食人火龍果卡片 | 2 | ep17_2_pitaya_y,md_pitaya_y | N | Y |
| 533 | pitman_worker_card | 勞碌礦工魔卡片 | 1 | ill_pitman | N | Y |
| 534 | plaga3_card | 魔癮普拉加卡片 | 1 | ep17_2_plaga3 | N | Y |
| 535 | plaga_card | 普拉加卡片 | 1 | ep17_1_plaga1 | N | Y |
| 536 | plagarion_card | 普拉加里安卡片 | 1 | plagarion | N | Y |
| 537 | plasma_arch_card | 穹拱等離子體卡片 | 0 | - | N | Y |
| 538 | plasma_r2_card | 尖銳魔力卡片 | 1 | ep17_2_plasma_r2 | N | Y |
| 539 | plasma_r_card | 強大魔力卡片 | 1 | ep17_2_plasma_r | N | Y |
| 540 | plasma_spt_card | 光譜等離子體卡片 | 0 | - | N | Y |
| 541 | plasma_y_card | 釋放魔力卡片 | 1 | ep17_2_plasma_y | N | Y |
| 542 | playing_pere_card | 演奏貝爾卡片 | 2 | pere1,pere4 | N | Y |
| 543 | playingpere_card | 演奏貝爾卡片 | 0 | - | N | Y |
| 544 | poe_card | 保羅卡片 | 0 | - | N | Y |
| 545 | poison_spore_card | 毒魔菇卡片 | 3 | e_poisonspore,c2_poison_spore | N | Y |
| 546 | poisonous_card | 奪命毒霧卡片 | 1 | poisonous | N | Y |
| 547 | polluted_dark_l_card | 汙染黑暗之王卡片 | 1 | dark_lord_h | N | Y |
| 548 | polluted_ray_a_card | 汙染幽靈弓箭手卡片 | 1 | raydric_archer_h | N | Y |
| 549 | polluted_raydric_card | 汙染幽靈劍士卡片 | 1 | raydric_h | N | Y |
| 550 | polluted_spi_q_card | 汙染蜘蛛女王卡片 | 1 | brinaranea_h | N | Y |
| 551 | polluted_sting_card | 汙染史汀卡片 | 1 | sting_h | N | Y |
| 552 | polluted_w_man_card | 汙染邪骸浪人卡片 | 1 | wander_man_h | N | Y |
| 553 | porcellio_w_card | 白色三葉鐵甲蟲卡片 | 1 | porcellio_w | N | Y |
| 554 | pot_dofle_card | 醬缸章魚卡片 | 1 | pot_dofle | N | Y |
| 555 | pray_giver_card | 祈願墮天使卡片 | 0 | - | N | Y |
| 556 | primitive_rgan_card | 原始蠕蟲卡片 | 0 | - | N | Y |
| 557 | princess_meer_card | 王女メアカード | 0 | - | N | Y |
| 558 | prison_breaker_card | 越獄腐屍卡片 | 1 | ragged_zombie_h | N | Y |
| 559 | professor_card | 闇●智者 西里亞卡片 | 0 | - | N | Y |
| 560 | pyuriel_card | 淘汰者傅立葉卡片 | 1 | pyuriel | N | Y |
| 561 | q_scaraba_card | 女王甲蟲卡片 | 0 | - | N | Y |
| 562 | r001_bestia_card | R001-貝斯帝亞卡片 | 1 | r001_bestia | N | Y |
| 563 | r48_85_bestia_card | R48-85-BESTIA卡片 | 1 | ep17_1_r4885_bestia | N | Y |
| 564 | r_sealed_card | Sealed Card Converter | 0 | - | N | Y |
| 565 | r_superior_rgan_card | 被改造的高級蠕蟲卡片 | 0 | - | N | Y |
| 566 | rabbit_iceslug_card | Snow Rabbit Slug Card | 0 | - | N | Y |
| 567 | ranger_card | 闇·遊俠 迪文卡片 | 1 | v_b_shecil | N | Y |
| 568 | real_alphoccio_card | 真·宮廷樂師卡片 | 1 | v_alphoccio | N | Y |
| 569 | real_blank_card | ブランクカード | 0 | - | N | Y |
| 570 | real_ceila_card | 真·元素使卡片 | 1 | v_celia | N | Y |
| 571 | real_chen_card | 真·修羅卡片 | 1 | v_chen | N | Y |
| 572 | real_eremes_card | 真·十字切割者卡片 | 1 | v_eremes | N | Y |
| 573 | real_flamel_card | 真·基因學者卡片 | 1 | v_flamel | N | Y |
| 574 | real_gertie_card | 真·逐影卡片 | 1 | v_gertie | N | Y |
| 575 | real_harword_card | 真·機匠卡片 | 1 | v_harword | N | Y |
| 576 | real_katrinn_card | 真·大法師卡片 | 1 | v_katrinn | N | Y |
| 577 | real_magaleta_card | 真·大主教卡片 | 1 | v_magaleta | N | Y |
| 578 | real_randel_card | 真·皇家衛士卡片 | 1 | v_randel | N | Y |
| 579 | real_seyren_card | 真·符文騎士卡片 | 1 | v_seyren | N | Y |
| 580 | real_shecil_card | 真·遊俠卡片 | 1 | v_shecil | N | Y |
| 581 | real_trentini_card | 真·漫遊舞者卡片 | 1 | v_trentini | N | Y |
| 582 | reaperankou_card | 死神安庫卡片 | 0 | - | N | Y |
| 583 | rechenier_card | 萊採尼芮卡片 | 1 | geffen_mage_9 | N | Y |
| 584 | red_key_card | 紅色鑰匙卡片 | 0 | - | N | Y |
| 585 | redpepper_card | 紅椒卡片 | 1 | md_redpepper | N | Y |
| 586 | redpepper_h_card | 夢魘紅椒卡片 | 1 | md_redpepper_h | N | Y |
| 587 | regen_scientist_card | 雷根修蘆科學家卡片 | 1 | md_ed_m_science | N | Y |
| 588 | reginleif_card | 瑞吉蕾芙卡片 | 0 | - | N | Y |
| 589 | reken_guard_card | 雷根貝勒護衛卡片 | 0 | - | N | Y |
| 590 | reken_h_guard_card | 雷根貝勒高級護衛卡片 | 0 | - | N | Y |
| 591 | renire_card | Renire Card | 0 | - | N | Y |
| 592 | repair_robot_t_card | 修復機器人卡片 | 1 | repair_robot_t | N | Y |
| 593 | repairrobot_t_card | 修復機器人卡片 | 0 | - | N | Y |
| 594 | rgan_chief_clean_card | Sanctuary Cleaning Chief Card | 0 | - | N | Y |
| 595 | ringco_card | 靈克卡片 | 0 | - | N | Y |
| 596 | ro_amis_card | RO女孩卡片-Amis | 0 | - | N | Y |
| 597 | ro_catcy_card | RO女孩卡片-可希 | 0 | - | N | Y |
| 598 | ro_dalcom_card | RO女孩卡片-曾甜 | 0 | - | N | Y |
| 599 | ro_jinyung_card | RO女孩卡片-梓寧 | 0 | - | N | Y |
| 600 | ro_mia_card | RO女孩卡片-Mia | 0 | - | N | Y |
| 601 | ro_pipi_card | RO女孩卡片-派派 | 0 | - | N | Y |
| 602 | ro_sobum_card | RO女孩卡片-小帆 | 0 | - | N | Y |
| 603 | ro_sowoo_card | RO女孩卡片-小羽 | 0 | - | N | Y |
| 604 | ro_sowul_card | RO女孩卡片-心玥 | 0 | - | N | Y |
| 605 | ro_soyeun_card | RO女孩卡片-小研 | 0 | - | N | Y |
| 606 | ro_transportation_card | RO單程旅遊卡 | 0 | - | N | Y |
| 607 | ro_yeppy_card | RO女孩卡片-耶比 | 0 | - | N | Y |
| 608 | ro_yiyi_card | RO女孩卡片-伊伊 | 0 | - | N | Y |
| 609 | roaming_splbook_card | 流浪魔法書卡片 | 1 | ep17_2_roaming_splbook | N | Y |
| 610 | rock_step_card | 變異機器人卡片 | 1 | rock_step | N | Y |
| 611 | rock_striker_card | Rockstriker Card | 0 | - | N | Y |
| 612 | royalguard_card | 闇·皇家衛士 蘭達卡片 | 1 | v_b_randel | N | Y |
| 613 | rr_arclouse_card | 沼澤卷甲蟲卡片 | 1 | rr_arclouse | N | Y |
| 614 | rr_cramp_card | 溝鼠卡片 | 1 | rr_cramp | N | Y |
| 615 | rudo_card | 魯盜卡片 | 0 | - | N | Y |
| 616 | runeknight_card | 闇·符文騎士 賽依連卡片 | 1 | v_b_seyren | N | Y |
| 617 | s_agnes_card | 阿格奈什·雷根布爾格卡片 | 0 | - | N | Y |
| 618 | s_catherine_card | 凱薩琳·吉爾伯格卡片 | 0 | - | N | Y |
| 619 | s_crux_card | 克魯斯·帕音德卡片 | 0 | - | N | Y |
| 620 | s_elena_card | 反叛者埃琳娜·博克巴卡片 | 0 | - | N | Y |
| 621 | s_est_card | 反叛者艾絲特·拉夫羅伊卡片 | 0 | - | N | Y |
| 622 | s_friedrich_card | 弗里德里希S.海爾內卡片 | 0 | - | N | Y |
| 623 | s_gony_card | 反叛者高尼卡片 | 0 | - | N | Y |
| 624 | s_helmut_card | 赫爾穆特·雷根布爾格卡片 | 0 | - | N | Y |
| 625 | s_issac_card | 艾薩克·維格納卡片 | 0 | - | N | Y |
| 626 | s_jurgen_card | 尤勒基恩·維格納卡片 | 0 | - | N | Y |
| 627 | s_kathryn_card | 卡特琳·維格納卡片 | 0 | - | N | Y |
| 628 | s_kronecker_card | 克羅內克爾G.海爾內卡片 | 0 | - | N | Y |
| 629 | s_leizi_card | 秘密之翼雷基卡片 | 0 | - | N | Y |
| 630 | s_lookie_card | 反叛者小蟲卡片 | 0 | - | N | Y |
| 631 | s_meyer_card | 邁耶·雷根布爾格卡片 | 0 | - | N | Y |
| 632 | s_nihil_card | 尼希爾M.海爾內卡片 | 0 | - | N | Y |
| 633 | s_poe_card | 保羅·雷哈特卡片 | 0 | - | N | Y |
| 634 | s_rgan_healer_card | Superior Rgan Healer Card | 0 | - | N | Y |
| 635 | s_rgan_warlock_card | Superior Rgan Warlock Card | 0 | - | N | Y |
| 636 | s_skia_card | 斯琪亞·內里烏斯卡片 | 0 | - | N | Y |
| 637 | s_spica_card | 斯皮卡·內里烏斯卡片 | 0 | - | N | Y |
| 638 | s_tes_card | 秘密之翼菲洛芬泰斯卡片 | 0 | - | N | Y |
| 639 | s_wolf_card | 沃爾夫·雷根布爾格卡片 | 0 | - | N | Y |
| 640 | sakray_card | 薩克萊卡片 | 0 | - | N | Y |
| 641 | sanare3_card | 魔癮薩納雷卡片 | 1 | ep17_2_sanare3 | N | Y |
| 642 | sanare_card | 薩納雷卡片 | 1 | ep17_1_sanare1 | N | Y |
| 643 | sarah_card | 莎拉卡片 | 1 | mm_sarah | N | Y |
| 644 | scaraba_card | 甲蟲卡片 | 3 | c4_rake_scaraba,c1_horn_scaraba | N | Y |
| 645 | schmidt_card | 史密特國王卡片 | 0 | - | N | Y |
| 646 | scorpion_king_card | 蠍子之王卡片 | 0 | - | N | Y |
| 647 | scr_mt_robots_card | 廢鐵機器人卡片 | 1 | scr_mt_robots | N | Y |
| 648 | scrat_card | 鼠奎特卡片 | 0 | - | N | Y |
| 649 | sealed_amon_ra_card | 封印古埃及王卡片 | 0 | - | N | Y |
| 650 | sealed_atroce_card | 封印阿特羅斯卡片 | 0 | - | N | Y |
| 651 | sealed_b_harword_card | 封印闇●神工匠 哈沃得卡片 | 0 | - | N | Y |
| 652 | sealed_b_magaleta_card | 封印闇●神官 瑪嘉雷特卡片 | 0 | - | N | Y |
| 653 | sealed_b_shecil_card | 封印闇●神射手 迪文卡片 | 0 | - | N | Y |
| 654 | sealed_b_ygnizem_card | 封印闇●劍士 賽尼亞卡片 | 0 | - | N | Y |
| 655 | sealed_bacsojin_card | 封印白素貞卡片 | 0 | - | N | Y |
| 656 | sealed_berz_card | 封印貝雷傑卡片 | 0 | - | N | Y |
| 657 | sealed_card | 封印王卡卡冊 | 0 | - | N | Y |
| 658 | sealed_d_lord_card | 封印黑暗之王卡片 | 0 | - | N | Y |
| 659 | sealed_dracula_card | 封印德古拉伯爵卡片 | 0 | - | N | Y |
| 660 | sealed_drake_card | Sealed Drake Card | 0 | - | N | Y |
| 661 | sealed_eddga_card | 封印虎王卡片 | 0 | - | N | Y |
| 662 | sealed_f_bishop_card | 封印墮落的大神官卡片 | 0 | - | N | Y |
| 663 | sealed_gloom_card | 封印影魔卡片 | 0 | - | N | Y |
| 664 | sealed_ifrit_card | 封印伊夫利特卡片 | 0 | - | N | Y |
| 665 | sealed_kiel_card | 封印基爾-D-01卡片 | 0 | - | N | Y |
| 666 | sealed_knight_ws_card | 封印冰暴騎士卡片 | 0 | - | N | Y |
| 667 | sealed_ktullanux_card | 封印水晶龍卡片 | 0 | - | N | Y |
| 668 | sealed_lady_tanee_card | 封印嗒妮小姐卡片 | 0 | - | N | Y |
| 669 | sealed_m_flower_card | 封印月夜貓卡片 | 0 | - | N | Y |
| 670 | sealed_mistress_card | 封印蜂后卡片 | 0 | - | N | Y |
| 671 | sealed_orc_hero_card | 封印獸人英雄卡片 | 0 | - | N | Y |
| 672 | sealed_orc_load_card | 封印獸人酋長卡片 | 0 | - | N | Y |
| 673 | sealed_pharaoh_card | 封印法老王卡片 | 0 | - | N | Y |
| 674 | sealed_phreeoni_card | 封印皮里恩卡片 | 0 | - | N | Y |
| 675 | sealed_rand_card | 封印瓦爾基里 蘭特克力斯卡片 | 0 | - | N | Y |
| 676 | sealed_samurai_card | 封印元靈武士卡片 | 0 | - | N | Y |
| 677 | sealed_tao_card | 封印塔奧群卡卡片 | 0 | - | N | Y |
| 678 | sealed_turtleg_card | 封印烏龜將軍卡片 | 0 | - | N | Y |
| 679 | sedora_card | 塞杜拉卡片 | 2 | sedora,c4_sedora | N | Y |
| 680 | shadowchaser_card | 闇·逐影 科迪卡片 | 1 | v_b_gertie | N | Y |
| 681 | shining_seaweed_card | 閃亮海帶卡片 | 0 | - | N | Y |
| 682 | shining_t_bear_card | 光芒泰迪熊卡片 | 1 | ill_teddy_bear_s | N | Y |
| 683 | shnaim_card | 魔神使徒許乃任卡片 | 1 | mm_gb_morocc_4 | N | Y |
| 684 | sid_card | 喜德卡片 | 0 | - | N | Y |
| 685 | sieglouse_card | 吉克勞斯甲蟲卡片 | 0 | - | N | Y |
| 686 | silva_papilia_card | 席瓦帕皮利亞卡片 | 1 | md_silva_papilia | N | Y |
| 687 | simulation_juncea_card | 仿真蓉可兒卡片 | 0 | - | N | Y |
| 688 | singing_pere_card | 唱歌貝爾卡片 | 2 | pere2,pere3 | N | Y |
| 689 | singingpere_card | 唱歌貝爾卡片 | 0 | - | N | Y |
| 690 | sinister_obsidian_card | 邪念黑曜石卡片 | 1 | ill_obsidian | N | Y |
| 691 | skeggiold_card | 褐方體惡魔卡片 | 2 | skeggiold,skeggiold_ | N | Y |
| 692 | skel_prisoner_card | 邪骸戰俘卡片 | 1 | skel_prisoner | N | Y |
| 693 | skia_card | 斯琪亞卡片 | 0 | - | N | Y |
| 694 | sld_b_katrinn_card | 封印闇●超魔導師 凱特莉娜卡片 | 0 | - | N | Y |
| 695 | sld_baphomet_card | 封印巴風特卡片 | 0 | - | N | Y |
| 696 | sld_champion_card | 封印闇●武術宗師 陳理歐卡片 | 0 | - | N | Y |
| 697 | sld_clown_card | 封印闇●搞笑藝人 雅歐帕奇爾卡片 | 0 | - | N | Y |
| 698 | sld_creator_card | 封印闇●創造者 普拉梅姆卡片 | 0 | - | N | Y |
| 699 | sld_daehyon_card | 封印將軍大賢卡片 | 0 | - | N | Y |
| 700 | sld_dark_snake_card | 封印墨蛇君卡片 | 0 | - | N | Y |
| 701 | sld_detale_card | 封印迪塔勒泰晤勒斯卡片 | 0 | - | N | Y |
| 702 | sld_garm_card | 封印卡侖卡片 | 0 | - | N | Y |
| 703 | sld_gioia_card | 封印喬伊亞卡片 | 0 | - | N | Y |
| 704 | sld_grave_amon_ra_card | 封印滅絕古埃及王卡片 | 0 | - | N | Y |
| 705 | sld_gypsy_card | 封印闇●冷豔舞姬 特蘭提尼卡片 | 0 | - | N | Y |
| 706 | sld_kades_card | 封印守護者卡德斯卡片 | 0 | - | N | Y |
| 707 | sld_lord_of_death_card | 封印死靈騎士卡片 | 0 | - | N | Y |
| 708 | sld_maya_card | 封印蟻后卡片 | 0 | - | N | Y |
| 709 | sld_paladin_card | 封印闇●聖殿十字軍 蘭達卡片 | 0 | - | N | Y |
| 710 | sld_professor_card | 封印闇●智者 西里亞卡片 | 0 | - | N | Y |
| 711 | sld_pyuriel_card | 封印淘汰者傅立葉卡片 | 0 | - | N | Y |
| 712 | sld_q_scaraba_card | 封印女王甲蟲卡片 | 0 | - | N | Y |
| 713 | sld_stalker_card | 封印闇●神行太保 科迪卡片 | 0 | - | N | Y |
| 714 | sld_thanatos_card | 封印魔劍士 達納托斯的記憶卡片 | 0 | - | N | Y |
| 715 | sld_timeholder_card | 封印時間支配者卡片 | 0 | - | N | Y |
| 716 | smile_giver_card | 歡笑墮天使卡片 | 0 | - | N | Y |
| 717 | snow_angel_card | Snowstorm Angel Card | 0 | - | N | Y |
| 718 | soldier_andre_card | 戰蟻卡片 | 0 | - | N | Y |
| 719 | sorcerer_card | 闇·元素使 西里亞卡片 | 1 | v_b_celia | N | Y |
| 720 | spare_card | Spare Card | 0 | - | N | Y |
| 721 | spica_card | 斯皮卡卡片 | 0 | - | N | Y |
| 722 | sropho_card | 深海電鰻卡片 | 1 | sropho | N | Y |
| 723 | stalker_card | 闇●神行太保 科迪卡片 | 0 | - | N | Y |
| 724 | step_card | 變異晶片卡片 | 1 | step | N | Y |
| 725 | sura_card | 闇·修羅 陳理歐卡片 | 1 | v_b_chen | N | Y |
| 726 | sweet_night_m_card | 幻影夢魘卡片 | 1 | ill_nightmare | N | Y |
| 727 | sweetnightm_card | 幻影夢魘卡片 | 0 | - | N | Y |
| 728 | sweety_card | 斯威蒂卡片 | 1 | md_sweety | N | Y |
| 729 | sword_guardian_card | 機械劍士卡片 | 0 | - | N | Y |
| 730 | t_w_o_card | T_W_O卡片 | 1 | t_w_o | N | Y |
| 731 | tamruan_card | 塔嚕安卡片 | 2 | tamruan,c4_tamruan | N | Y |
| 732 | tappy_card | 塔皮卡片 | 1 | taffy | N | Y |
| 733 | tcg_card | 波士尼亞旅遊券 | 0 | - | N | Y |
| 734 | tendrilion_card | 三角獸卡片 | 0 | - | N | Y |
| 735 | tengu_card | 天狗卡片 | 1 | tengu | N | Y |
| 736 | tes_card | 泰斯卡片 | 0 | - | N | Y |
| 737 | tha_anger_card | 達納托斯的憤怒卡片 | 0 | - | N | Y |
| 738 | tha_horror_card | 達納托斯的恐懼卡片 | 0 | - | N | Y |
| 739 | tha_regret_card | 達納托斯的後悔卡片 | 0 | - | N | Y |
| 740 | tha_resent_card | 達納托斯的怨懟卡片 | 0 | - | N | Y |
| 741 | thanatos_card | 魔劍士 達納托斯的記憶卡片 | 1 | thanatos | N | Y |
| 742 | the_one_card | 變異救世主凱美拉卡片 | 1 | chimera_theone | N | Y |
| 743 | tiara_card | 提亞拉卡片 | 0 | - | N | Y |
| 744 | tikbalang_card | 邪魔馬卡片 | 1 | tikbalang | N | Y |
| 745 | timbers_card | Timbers Card | 0 | - | N | Y |
| 746 | time_keeper_card | 時光守護者卡片 | 1 | time_keeper | N | Y |
| 747 | timeholder_card | 時間支配者卡片 | 1 | timeholder | N | Y |
| 748 | tiyanak_card | 惡魔嬰兒卡片 | 0 | - | N | Y |
| 749 | toxious_card | 絕命毒霧卡片 | 1 | toxious | N | Y |
| 750 | treasure_mimic_card | 珠寶邪惡箱卡片 | 0 | - | N | Y |
| 751 | ultra_limacina_card | 終極青翅巨鳥卡片 | 0 | - | N | Y |
| 752 | undead_knight_f_card | 怨恨騎士卡片 | 1 | mg_f_undead_knight | N | Y |
| 753 | undead_knight_m_card | 痛苦騎士卡片 | 1 | mg_m_undead_knight | N | Y |
| 754 | undeadknightf_card | 怨恨騎士卡片 | 0 | - | N | Y |
| 755 | undeadknightm_card | 痛苦騎士卡片 | 0 | - | N | Y |
| 756 | unfrost_flower_card | 冰霜花卡片 | 0 | - | N | Y |
| 757 | unknown_swordman_card | 無名的劍士卡片 | 0 | - | N | Y |
| 758 | upd_bow_guardian_card | 強化弓箭手監護人魔物卡片 | 0 | - | N | Y |
| 759 | upd_byorgue_card | 強化漂流浪人卡片 | 0 | - | N | Y |
| 760 | upd_maya_puple_card | 強化狂暴蟻后卡片 | 0 | - | N | Y |
| 761 | upd_necromancer_card | 強化行妖術者卡片 | 0 | - | N | Y |
| 762 | upd_salamander_card | 強化火蜥蜴卡片 | 0 | - | N | Y |
| 763 | uzhas_card | 樹林女巫卡片 | 0 | - | N | Y |
| 764 | vanilaqus_card | 變異水精靈凱美拉卡片 | 1 | chimera_vanilaqus | N | Y |
| 765 | vavayaga_card | 芭芭亞卡卡片 | 1 | c5_vavayaga | N | Y |
| 766 | venedi_card | 貝納迪卡片 | 1 | venedi | N | Y |
| 767 | venenum3_card | 下水道貝納姆卡片 | 1 | ep17_2_venenum3 | N | Y |
| 768 | venenum_card | 貝納姆卡片 | 1 | ep17_1_venenum1 | N | Y |
| 769 | venom_kimera_card | 劇毒凱美拉卡片 | 1 | ep16_2_venom_kimera | N | Y |
| 770 | verporta_card | 韋爾波泰卡片 | 1 | md_verporta | N | Y |
| 771 | verporte_h_card | 韋爾波特卡片 | 1 | md_verporte_h | N | Y |
| 772 | vip_black_card | 프리미엄 블랙카드 | 0 | - | N | Y |
| 773 | void_mimic_card | 惡靈邪惡箱卡片 | 0 | - | N | Y |
| 774 | vr_reading_card | Reading Card | 0 | - | N | Y |
| 775 | wakwak_card | 食屍鬼卡片 | 1 | wakwak | N | Y |
| 776 | wanderer_card | 闇·漫遊舞者 特蘭提尼卡片 | 1 | v_b_trentini | N | Y |
| 777 | warlock_card | 闇·大法師 凱特莉娜卡片 | 1 | v_b_katrinn | N | Y |
| 778 | waterfall_card | 下水道瀑布卡片 | 1 | ep17_2_waterfall | N | Y |
| 779 | wet_sealed_card | 물에 젖은 봉인된 인장 | 0 | - | N | Y |
| 780 | white_knightage_card | 白騎士團卡片 | 0 | - | N | Y |
| 781 | wicked_nymph_card | 妖仙女卡片 | 2 | wicked_nymph,c5_wicked_nymph | N | Y |
| 782 | wild_ginseng_card | 人參精卡片 | 1 | wild_ginseng | N | Y |
| 783 | witch_zilant_card | 魔女ジラントカード | 0 | - | N | Y |
| 784 | wizardofveritas_card | 真理超魔導師卡片 | 1 | ill_highwizard | N | Y |
| 785 | wood_goblin_card | 樹林哥布靈卡片 | 1 | c5_wood_goblin | N | Y |
| 786 | woodie_card | 小樹椿卡片 | 0 | - | N | Y |
| 787 | xm_celine_kimi_card | 席琳基米卡片 | 1 | xm_celine_kimi | N | Y |
| 788 | xm_cookie_card | 暴虐甜餅人卡片 | 1 | xm_cookie | N | Y |
| 789 | xm_hylozoist_card | 惡毒幽靈卡片 | 1 | xm_hylozoist | N | Y |
| 790 | xm_lude_card | 邪靈南瓜卡片 | 1 | xm_lude | N | Y |
| 791 | xm_marionette_card | 舞動傀儡卡片 | 1 | xm_marionette | N | Y |
| 792 | xm_mystcase_card | 惡靈禮盒卡片 | 1 | xm_mystcase | N | Y |
| 793 | xm_teddy_bear_card | 遺棄玩偶熊卡片 | 1 | xm_teddy_bear | N | Y |
| 794 | xm_tree_card | 惡靈樹裝飾卡片 | 1 | xm_tree | N | Y |
| 795 | yellow_key_card | 黃色鑰匙卡片 | 0 | - | N | Y |
| 796 | yordos_execute_card | Yordos Executor Card | 0 | - | N | Y |
| 797 | yordos_inve_card | Yordos Investigator Card | 0 | - | N | Y |
| 798 | yordos_judge_card | Yordos Judge Card | 0 | - | N | Y |
| 799 | yorker_r_worker_card | Yorker Religious Worker Card | 0 | - | N | Y |
| 800 | yorker_worker_card | Yorker Worker Card | 0 | - | N | Y |
| 801 | yormi_card | Yormi Card | 0 | - | N | Y |
| 802 | yormi_m_card | Yormi Missionary Card | 0 | - | N | Y |
| 803 | yortus_arbiter_card | Yortus Arbiter Card | 0 | - | N | Y |
| 804 | yortus_bailiff_card | Yortus Bailiff Card | 0 | - | N | Y |
| 805 | yortus_bishop_card | Yortus Bishop Card | 0 | - | N | Y |
| 806 | yortus_conjur_card | Yortus Conjurator Card | 0 | - | N | Y |
| 807 | yoscopus_s_card | Yoscopus Sorcerer Card | 0 | - | N | Y |
| 808 | yoster_cleaner_card | Yoster Cleaner Card | 0 | - | N | Y |
| 809 | yoster_collect_card | Yoster Collector Card | 0 | - | N | Y |
| 810 | yoster_cooker_card | Yoster Cooker Card | 0 | - | N | Y |
| 811 | yoster_fixer_card | Yoster Fixer Card | 0 | - | N | Y |
| 812 | yoster_nego_card | Yoster Negotiator Card | 0 | - | N | Y |
| 813 | zherlthsh_card | 艾斯恩魔女卡片 | 1 | zherlthsh | N | Y |
| 814 | zombie_guard_card | 殭屍警衛卡片 | 1 | zombie_guard | N | Y |
| 815 | zombie_master_card | 腐屍首領卡片 | 2 | zombie_master,c3_zombie_master | N | Y |