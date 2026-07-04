#!/usr/bin/env python3
"""
Food-Drug Interaction Dataset Generator
Fetches data from public APIs:
  - OpenFDA Drug Labels API (drug info + warnings)
  - NIH RxNorm API (drug names & classes)
  - USDA FoodData Central API (food compounds)
  - NDF-RT / MeSH (drug classes)

Outputs: expanded_interactions.js  (drop-in replacement for interactions.js data section)
"""

import json
import time
import re
import sys
import urllib.request
import urllib.parse
import urllib.error

# ─────────────────────────────────────────────
# PHARMACOLOGICAL FEATURE SCHEMA (30 features)
# Expanded from original 15 to capture more drug classes
# ─────────────────────────────────────────────
FOOD_FEATURES = [
    "cyp3a4_inhibitor",    # 0  e.g. Grapefruit, Pomegranate
    "vitamin_k_rich",       # 1  e.g. Leafy Greens, Soy
    "calcium_rich",         # 2  e.g. Dairy, Salt
    "tyramine_rich",        # 3  e.g. Aged Cheese, Soy Sauce
    "potassium_rich",       # 4  e.g. Bananas, Beetroot
    "alcohol_present",      # 5  e.g. Beer, Wine, Spirits
    "fiber_rich",           # 6  e.g. Oats, Flaxseed
    "oatp_inhibitor",       # 7  e.g. Apple Juice, Green Tea
    "glycyrrhizin",         # 8  e.g. Licorice
    "cyp1a2_inducer",       # 9  e.g. Broccoli, Char-grilled Meat
    "ginkgolide",           # 10 e.g. Garlic, Ginkgo
    "hypoglycemic_herb",    # 11 e.g. Ginseng, Fenugreek
    "cyp3a4_inducer",       # 12 e.g. St John's Wort
    "cyp2c9_inhibitor",     # 13 e.g. Cranberry, Turmeric
    "methylxanthines",      # 14 e.g. Coffee, Tea, Chocolate
    "nitrate_rich",         # 15 e.g. Beetroot, Spinach
    "tannin_rich",          # 16 e.g. Tea, Red Wine, Pomegranate
    "oxalate_rich",         # 17 e.g. Spinach, Rhubarb
    "omega3_antiplatelet",  # 18 e.g. Fatty Fish, Flaxseed, Walnuts
    "magnesium_rich",       # 19 e.g. Nuts, Seeds, Dark Chocolate
    "cyp2d6_inhibitor",     # 20 e.g. Valerian, Goldenseal
    "serotonin_precursor",  # 21 e.g. Turkey, Bananas, Walnuts
    "coumarin_rich",        # 22 e.g. Parsley, Celery, Cinnamon
    "antioxidant_polyphenol", # 23 e.g. Berries, Grapes
    "bitter_compounds",     # 24 e.g. Bitter Melon, Dandelion
    "capsaicin",            # 25 e.g. Chili Peppers
    "quercetin_rich",       # 26 e.g. Onions, Apples, Capers
    "phytate_rich",         # 27 e.g. Whole Grains, Legumes
    "lactose",              # 28 e.g. Milk, Yogurt
    "purines_rich",         # 29 e.g. Red Meat, Shellfish, Beer
]

DRUG_FEATURES = [
    "statin",               # 0  e.g. Atorvastatin, Simvastatin
    "anticoagulant",        # 1  e.g. Warfarin, Rivaroxaban
    "antibiotic",           # 2  e.g. Ciprofloxacin, Tetracycline
    "maoi",                 # 3  e.g. Phenelzine, Tranylcypromine
    "ace_inhibitor",        # 4  e.g. Lisinopril, Ramipril
    "acetaminophen",        # 5  e.g. Tylenol/Paracetamol
    "cardiac_glycoside",    # 6  e.g. Digoxin
    "calcium_channel",      # 7  e.g. Amlodipine, Verapamil
    "oatp_substrate",       # 8  e.g. Fexofenadine, Rosuvastatin
    "cyp1a2_substrate",     # 9  e.g. Theophylline, Clozapine
    "diuretic_k_sparing",   # 10 e.g. Spironolactone
    "nsaid_antiplatelet",   # 11 e.g. Aspirin, Ibuprofen
    "antidiabetic",         # 12 e.g. Metformin, Glipizide
    "ssri",                 # 13 e.g. Sertraline, Fluoxetine
    "contraceptive",        # 14 e.g. Ethinyl Estradiol
    "immunosuppressant",    # 15 e.g. Cyclosporine, Tacrolimus
    "thyroid_hormone",      # 16 e.g. Levothyroxine
    "pde5_inhibitor",       # 17 e.g. Sildenafil, Tadalafil
    "anticonvulsant",       # 18 e.g. Phenytoin, Carbamazepine
    "antiarrhythmic",       # 19 e.g. Amiodarone, Quinidine
    "benzodiazepine",       # 20 e.g. Diazepam, Lorazepam
    "opioid",               # 21 e.g. Codeine, Oxycodone
    "antihypertensive",     # 22 e.g. Metoprolol, Atenolol
    "antiplatelet",         # 23 e.g. Clopidogrel, Ticagrelor
    "mood_stabilizer",      # 24 e.g. Lithium, Valproate
    "antifungal",           # 25 e.g. Fluconazole, Ketoconazole
    "antiretroviral",       # 26 e.g. Ritonavir, Atazanavir
    "bisphosphonate",       # 27 e.g. Alendronate (Fosamax)
    "tetracycline",         # 28 e.g. Doxycycline, Minocycline
    "fluoroquinolone",      # 29 e.g. Ciprofloxacin, Levofloxacin
]

NFOOD = len(FOOD_FEATURES)
NDRUG = len(DRUG_FEATURES)

# ─────────────────────────────────────────────
# COMPREHENSIVE FOOD DATABASE (70+ foods)
# features array = NFOOD booleans
# ─────────────────────────────────────────────
FOODS_DB = [
    # FRUITS
    {"id":"grapefruit","name":"Grapefruit & Juice","category":"Fruit",
     "description":"Contains furanocoumarins (bergamottin, DHB) which irreversibly inhibit intestinal CYP3A4 enzymes, causing dramatic drug level spikes.",
     "features":[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,1,0,0,0],"moleculeName":"Bergamottin"},
    {"id":"pomegranate","name":"Pomegranate Juice","category":"Fruit",
     "description":"Rich in ellagitannins. Inhibits CYP3A4 and CYP2C9, raising plasma levels of many drugs.",
     "features":[1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,0,0,1,0,0,1,0,0,0],"moleculeName":"Ellagic Acid"},
    {"id":"apple_juice","name":"Apple & Orange Juice","category":"Fruit",
     "description":"Naringin blocks OATP1A2 transporters, reducing absorption of antihistamines and some statins.",
     "features":[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0],"moleculeName":"Naringin"},
    {"id":"cranberry_juice","name":"Cranberry Juice","category":"Fruit",
     "description":"Flavonoids inhibit CYP2C9, slowing clearance of Warfarin and other drugs.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0],"moleculeName":"Naringenin"},
    {"id":"bananas","name":"Bananas & Avocados","category":"Fruit",
     "description":"Extremely high potassium content. Dangerous with potassium-retaining drugs.",
     "features":[0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0],"moleculeName":"Potassium Ion"},
    {"id":"blueberries","name":"Blueberries & Mixed Berries","category":"Fruit",
     "description":"Rich in anthocyanins and polyphenols. Mild CYP2C9 inhibition; antiplatelet effects at high doses.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Anthocyanin"},
    {"id":"grapes_raisins","name":"Grapes & Raisins","category":"Fruit",
     "description":"Resveratrol inhibits CYP3A4. High tyramine in raisins/dried grapes can react with MAOIs.",
     "features":[1,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Resveratrol"},
    {"id":"kiwi","name":"Kiwi Fruit","category":"Fruit",
     "description":"High Vitamin K content can interfere with Warfarin. Also rich in potassium.",
     "features":[0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Vitamin C"},
    {"id":"mango","name":"Mango","category":"Fruit",
     "description":"High Vitamin K. Mangiferin may inhibit CYP3A4. Contains some quercetin.",
     "features":[1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0],"moleculeName":"Mangiferin"},
    {"id":"papaya","name":"Papaya","category":"Fruit",
     "description":"Papain enzyme and flavonoids. May interact with anticoagulants. High Vitamin K.",
     "features":[0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Papain"},

    # VEGETABLES
    {"id":"leafy_greens","name":"Leafy Greens (Spinach, Kale)","category":"Vegetables",
     "description":"Extremely high Vitamin K. Directly antagonizes Warfarin's mechanism.",
     "features":[0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1,0,1,0,0,0,1,0,0,1,0,0,0],"moleculeName":"Vitamin K1"},
    {"id":"broccoli","name":"Broccoli & Brussels Sprouts","category":"Vegetables",
     "description":"Cruciferous indoles strongly induce liver CYP1A2, accelerating clearance of many drugs.",
     "features":[0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0],"moleculeName":"Indole-3-carbinol"},
    {"id":"beetroot","name":"Beetroot & Beet Juice","category":"Vegetables",
     "description":"Extremely high in dietary nitrates → nitric oxide. Dangerous with nitrate drugs and PDE5 inhibitors.",
     "features":[0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Betanin"},
    {"id":"parsley_celery","name":"Parsley, Celery & Herbs","category":"Vegetables",
     "description":"Rich in furanocoumarins (different from grapefruit) and coumarins. Mild anticoagulant and CYP interaction.",
     "features":[0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,0],"moleculeName":"Apigenin"},
    {"id":"garlic_ginkgo","name":"Garlic & Ginkgo Supplements","category":"Supplements",
     "description":"Natural antiplatelet factors. Synergises dangerously with anticoagulants.",
     "features":[0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Ginkgolide B"},
    {"id":"onion_quercetin","name":"Onions & Capers","category":"Vegetables",
     "description":"Very high quercetin content. Quercetin inhibits CYP3A4, P-glycoprotein, and has antiplatelet effects.",
     "features":[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,1,0,0,0],"moleculeName":"Quercetin"},
    {"id":"chili_pepper","name":"Chili Peppers & Cayenne","category":"Vegetables",
     "description":"Capsaicin alters GI motility and absorption rates. May intensify blood-thinning effects at high doses.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0],"moleculeName":"Capsaicin"},
    {"id":"tomatoes","name":"Tomatoes & Tomato Sauce","category":"Vegetables",
     "description":"Rich in lycopene. Moderate potassium. May mildly inhibit CYP2C9.",
     "features":[0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Lycopene"},

    # DAIRY & PROTEIN
    {"id":"dairy","name":"Dairy Products (Milk, Yogurt)","category":"Dairy",
     "description":"High calcium chelates antibiotics, tetracyclines, fluoroquinolones, and levothyroxine in the gut.",
     "features":[0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0],"moleculeName":"Calcium Carbonate"},
    {"id":"aged_cheese","name":"Aged Cheese & Cured Meats","category":"Fermented",
     "description":"Very high tyramine. Combined with MAOIs causes life-threatening hypertensive crisis.",
     "features":[0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],"moleculeName":"Tyramine"},
    {"id":"eggs","name":"Eggs","category":"Protein",
     "description":"Generally safe with most medications. High biotin may interfere with lab tests. Minor vitamin K.",
     "features":[0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],"moleculeName":"Choline"},
    {"id":"high_protein","name":"High-Protein Diet (Meat)","category":"Diet Pattern",
     "description":"Induces CYP1A2. Speeds up clearance of theophylline and other CYP1A2-metabolized drugs.",
     "features":[0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],"moleculeName":"Leucine"},
    {"id":"red_meat","name":"Red Meat & Processed Meats","category":"Protein",
     "description":"High in purines (gout risk), saturated fat, and tyramine precursors. Char-grilling induces CYP1A2.",
     "features":[0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],"moleculeName":"Heme Iron"},
    {"id":"fatty_fish","name":"Fatty Fish (Salmon, Mackerel)","category":"Protein",
     "description":"High omega-3 (EPA/DHA) inhibit platelet aggregation. Potentiates anticoagulants.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"EPA/DHA"},

    # GRAINS & LEGUMES
    {"id":"fiber_oats","name":"Oatmeal & High Fiber Bran","category":"Grain",
     "description":"Soluble beta-glucan binds to digoxin and other drugs, trapping them in the gut.",
     "features":[0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0],"moleculeName":"Beta-Glucan fragment"},
    {"id":"soy_foods","name":"Soy & Tofu","category":"Legume",
     "description":"Isoflavones inhibit thyroid hormone absorption. High Vitamin K. Mild hypoglycemic effects.",
     "features":[0,1,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0],"moleculeName":"Genistein"},
    {"id":"flaxseed","name":"Flaxseed & Flaxseed Oil","category":"Seeds",
     "description":"High fiber and lignans. Omega-3 antiplatelet effects. May delay drug absorption.",
     "features":[0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0],"moleculeName":"Alpha-Linolenic Acid"},
    {"id":"whole_grains","name":"Whole Grains (Wheat, Brown Rice)","category":"Grain",
     "description":"Phytates bind to metal cations including iron, zinc, and some drugs like tetracyclines.",
     "features":[0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0],"moleculeName":"Phytic Acid"},
    {"id":"legumes","name":"Beans & Lentils","category":"Legume",
     "description":"High potassium, fiber, and phytates. May modestly reduce absorption of certain drugs.",
     "features":[0,0,0,0,1,0,1,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0],"moleculeName":"Folic Acid"},

    # BEVERAGES
    {"id":"alcohol","name":"Alcoholic Beverages","category":"Beverage",
     "description":"CNS depressant synergy with sedatives. Hepatotoxic pathway shift with acetaminophen. Tyramine in fermented varieties.",
     "features":[0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],"moleculeName":"Ethanol"},
    {"id":"coffee","name":"Coffee & Caffeine","category":"Beverage",
     "description":"Caffeine is a CYP1A2 substrate competing with drugs using the same enzyme. Also mildly acidic.",
     "features":[0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Caffeine"},
    {"id":"green_tea","name":"Green Tea & Matcha","category":"Beverage",
     "description":"EGCG inhibits OATP transporters. Vitamin K content affects anticoagulants. Mild CYP inhibition.",
     "features":[0,1,0,0,0,0,0,1,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,1,0,0,1,0,0,0],"moleculeName":"EGCG"},
    {"id":"black_tea","name":"Black Tea","category":"Beverage",
     "description":"High tannins reduce absorption of iron supplements and some drugs. Caffeine content competes with CYP1A2.",
     "features":[0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,1,0,0,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Theaflavin"},
    {"id":"energy_drinks","name":"Energy Drinks","category":"Beverage",
     "description":"Very high caffeine + taurine + B-vitamins. Extreme CYP1A2 competition. May increase blood pressure with stimulants.",
     "features":[0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Caffeine"},

    # SUPPLEMENTS & HERBS
    {"id":"st_johns_wort","name":"St. John's Wort","category":"Supplements",
     "description":"Potent CYP3A4 and P-gp inducer. Reduces blood levels of dozens of drugs.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0],"moleculeName":"Hyperforin"},
    {"id":"ginseng","name":"Ginseng Supplement","category":"Supplements",
     "description":"Ginsenosides have hypoglycemic and mild antiplatelet actions. May affect INR.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Ginsenoside Rg1"},
    {"id":"black_licorice","name":"Black Licorice (Real)","category":"Confection",
     "description":"Glycyrrhizin causes potassium loss and sodium retention. Opposes potassium-sparing diuretics.",
     "features":[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Glycyrrhizin"},
    {"id":"valerian","name":"Valerian Root","category":"Supplements",
     "description":"Sedative herb. Potentiates CNS depressants including benzodiazepines, opioids, and alcohol.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],"moleculeName":"Valerenic Acid"},
    {"id":"kava","name":"Kava Kava","category":"Supplements",
     "description":"Hepatotoxic potential. Inhibits multiple CYP enzymes. Strong CNS depression synergy.",
     "features":[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],"moleculeName":"Kavalactone"},
    {"id":"echinacea","name":"Echinacea","category":"Supplements",
     "description":"Modestly inhibits CYP3A4 and may induce CYP1A2. Can reduce immunosuppressant efficacy.",
     "features":[1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Echinacoside"},
    {"id":"turmeric","name":"Turmeric & Curcumin","category":"Spice / Supplement",
     "description":"Curcumin inhibits CYP3A4, CYP2C9, and has antiplatelet effects.",
     "features":[1,0,0,0,0,0,0,0,0,0,1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Curcumin"},
    {"id":"fenugreek","name":"Fenugreek Seeds","category":"Supplements",
     "description":"Hypoglycemic effects via trigonelline. High fiber delays absorption. Mild anticoagulant.",
     "features":[0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0],"moleculeName":"Trigonelline"},
    {"id":"bitter_melon","name":"Bitter Melon","category":"Supplements",
     "description":"Potent hypoglycemic action via charantin. Combined with antidiabetics causes severe hypoglycemia.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],"moleculeName":"Charantin"},
    {"id":"garlic_supplement","name":"Garlic Supplement (High Dose)","category":"Supplements",
     "description":"Allicin and alliin inhibit platelet aggregation. Mild CYP3A4 inhibition at high doses.",
     "features":[1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Allicin"},

    # CONDIMENTS & SPICES
    {"id":"salt_sodium","name":"High-Sodium Foods","category":"Diet Pattern",
     "description":"Sodium competes with lithium in renal reabsorption. Low sodium diets cause lithium toxicity.",
     "features":[0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Sodium Chloride"},
    {"id":"chocolate","name":"Chocolate & Cocoa","category":"Confection",
     "description":"Tyramine + methylxanthines. Dangerous with MAOIs. Caffeine competes with CYP1A2 substrates.",
     "features":[0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Theobromine"},
    {"id":"cinnamon","name":"Cinnamon (High Dose)","category":"Spice",
     "description":"Coumarin content at high doses has anticoagulant effects. Mild hypoglycemic action.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],"moleculeName":"Cinnamaldehyde"},
    {"id":"soy_sauce_miso","name":"Soy Sauce, Miso & Fermented Foods","category":"Fermented",
     "description":"Very high tyramine in fermented products. High sodium. Combined with MAOIs = hypertensive crisis.",
     "features":[0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1],"moleculeName":"Tyramine"},
    {"id":"pickled_foods","name":"Pickled & Fermented Vegetables","category":"Fermented",
     "description":"Fermentation produces tyramine. High sodium. The brine acidity may affect drug stability.",
     "features":[0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Lactic Acid"},

    # NUTS & SEEDS
    {"id":"walnuts","name":"Walnuts & Pecans","category":"Nuts",
     "description":"Omega-3 ALA antiplatelet. Quercetin content. May potentiate anticoagulants.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,1,0,1,0,0,1,0,0,0],"moleculeName":"Juglone"},
    {"id":"almonds","name":"Almonds & Nut Butters","category":"Nuts",
     "description":"High fiber and phytates may reduce drug absorption timing. High magnesium and Vitamin E.",
     "features":[0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0],"moleculeName":"Tocopherol"},

    # MISCELLANEOUS FOODS
    {"id":"grapeseed_oil","name":"Grapeseed & Flaxseed Oil","category":"Oils",
     "description":"Rich in omega-6/3 polyunsaturated fats. High dose fish/plant oils inhibit platelet aggregation.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Linoleic Acid"},
    {"id":"xylitol_sweeteners","name":"Artificial Sweeteners","category":"Processed",
     "description":"Generally safe but some alter gut microbiome which affects drug metabolism over time.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Sucralose"},
    {"id":"high_fat_meal","name":"High-Fat Meal","category":"Diet Pattern",
     "description":"Fat significantly increases bioavailability of lipophilic drugs like antiretrovirals and antifungals.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Triglyceride"},
]

# ─────────────────────────────────────────────
# COMPREHENSIVE DRUG DATABASE (60+ drugs)
# features array = NDRUG booleans
# ─────────────────────────────────────────────
DRUGS_DB = [
    # CARDIOVASCULAR
    {"id":"atorvastatin","name":"Atorvastatin (Lipitor)","category":"Statin / Cholesterol",
     "description":"Metabolized by CYP3A4. Used to lower LDL cholesterol.",
     "features":[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Atorvastatin"},
    {"id":"simvastatin","name":"Simvastatin (Zocor)","category":"Statin / Cholesterol",
     "description":"CYP3A4-metabolized statin. Higher myopathy risk than atorvastatin.",
     "features":[1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Simvastatin"},
    {"id":"rosuvastatin","name":"Rosuvastatin (Crestor)","category":"Statin / Cholesterol",
     "description":"OATP substrate. Less CYP3A4 dependent than other statins.",
     "features":[1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Rosuvastatin"},
    {"id":"warfarin","name":"Warfarin (Coumadin)","category":"Anticoagulant",
     "description":"CYP2C9 substrate. Vitamin K antagonist. Extremely narrow therapeutic index.",
     "features":[0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Warfarin"},
    {"id":"rivaroxaban","name":"Rivaroxaban (Xarelto)","category":"Anticoagulant",
     "description":"Direct oral anticoagulant (DOAC). CYP3A4 and P-gp substrate.",
     "features":[0,1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Rivaroxaban"},
    {"id":"apixaban","name":"Apixaban (Eliquis)","category":"Anticoagulant",
     "description":"DOAC. CYP3A4 and P-gp substrate. Less food interaction than warfarin.",
     "features":[0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Apixaban"},
    {"id":"amlodipine","name":"Amlodipine (Norvasc)","category":"Calcium Channel Blocker",
     "description":"CYP3A4 metabolized. Treats hypertension and angina.",
     "features":[0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],"moleculeName":"Amlodipine"},
    {"id":"lisinopril","name":"Lisinopril (Prinivil)","category":"ACE Inhibitor",
     "description":"ACE inhibitor. Causes potassium retention in kidneys.",
     "features":[0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],"moleculeName":"Lisinopril"},
    {"id":"ramipril","name":"Ramipril (Altace)","category":"ACE Inhibitor",
     "description":"ACE inhibitor. Same potassium-retention mechanism as lisinopril.",
     "features":[0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],"moleculeName":"Ramipril"},
    {"id":"spironolactone","name":"Spironolactone (Aldactone)","category":"Potassium-Sparing Diuretic",
     "description":"Retains potassium. Opposes licorice mechanism.",
     "features":[0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],"moleculeName":"Spironolactone"},
    {"id":"digoxin","name":"Digoxin (Lanoxin)","category":"Cardiac Glycoside",
     "description":"Narrow therapeutic index. Fiber binds it in the gut.",
     "features":[0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],"moleculeName":"Digoxin"},
    {"id":"metoprolol","name":"Metoprolol (Lopressor)","category":"Beta Blocker",
     "description":"CYP2D6 metabolized beta-blocker. Food increases bioavailability.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],"moleculeName":"Metoprolol"},
    {"id":"aspirin","name":"Aspirin (Ecotrin)","category":"NSAID / Antiplatelet",
     "description":"Antiplatelet aggregation. NSAIDs raise GI bleed risk.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Aspirin"},
    {"id":"clopidogrel","name":"Clopidogrel (Plavix)","category":"Antiplatelet",
     "description":"Prodrug activated by CYP2C19. CYP2C9 inhibitors reduce its efficacy.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],"moleculeName":"Clopidogrel"},
    {"id":"amiodarone","name":"Amiodarone (Cordarone)","category":"Antiarrhythmic",
     "description":"Potent inhibitor of CYP2C9, CYP3A4, CYP2D6. Interacts with almost every cardiac drug.",
     "features":[0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Amiodarone"},
    {"id":"sildenafil","name":"Sildenafil (Viagra)","category":"PDE5 Inhibitor",
     "description":"CYP3A4 substrate. Severely contraindicates nitrates.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Sildenafil"},

    # ANTIBIOTICS
    {"id":"ciprofloxacin","name":"Ciprofloxacin (Cipro)","category":"Fluoroquinolone Antibiotic",
     "description":"Chelates with metal cations (calcium, magnesium, iron). Inhibits CYP1A2.",
     "features":[0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],"moleculeName":"Ciprofloxacin"},
    {"id":"levofloxacin","name":"Levofloxacin (Levaquin)","category":"Fluoroquinolone Antibiotic",
     "description":"Like ciprofloxacin, chelates with metal cations reducing absorption.",
     "features":[0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],"moleculeName":"Levofloxacin"},
    {"id":"tetracycline","name":"Tetracycline","category":"Tetracycline Antibiotic",
     "description":"Chelates with calcium and dairy. Absorption halved by milk.",
     "features":[0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],"moleculeName":"Tetracycline"},
    {"id":"doxycycline","name":"Doxycycline (Vibramycin)","category":"Tetracycline Antibiotic",
     "description":"Less calcium interaction than tetracycline but still significant.",
     "features":[0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],"moleculeName":"Doxycycline"},
    {"id":"azithromycin","name":"Azithromycin (Zithromax)","category":"Macrolide Antibiotic",
     "description":"Inhibits CYP3A4. May interact with antacids containing aluminium/magnesium.",
     "features":[0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Azithromycin"},
    {"id":"amoxicillin","name":"Amoxicillin (Amoxil)","category":"Penicillin Antibiotic",
     "description":"Broadly safe with food. Minimal enzyme interactions. Food reduces GI upset.",
     "features":[0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Amoxicillin"},
    {"id":"fluconazole","name":"Fluconazole (Diflucan)","category":"Antifungal",
     "description":"Potent CYP2C9 and CYP3A4 inhibitor. Raises plasma levels of many drugs.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],"moleculeName":"Fluconazole"},

    # NEUROLOGICAL
    {"id":"nardil","name":"Phenelzine (Nardil)","category":"MAOI Antidepressant",
     "description":"Non-selective MAOI. Blocks tyramine breakdown causing hypertensive crisis with tyramine-rich foods.",
     "features":[0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Phenelzine"},
    {"id":"tranylcypromine","name":"Tranylcypromine (Parnate)","category":"MAOI Antidepressant",
     "description":"Irreversible MAOI. Same dietary restrictions as phenelzine.",
     "features":[0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Tranylcypromine"},
    {"id":"sertraline","name":"Sertraline (Zoloft)","category":"SSRI Antidepressant",
     "description":"SSRI. CYP2C19 and CYP2D6 inhibitor.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Sertraline"},
    {"id":"fluoxetine","name":"Fluoxetine (Prozac)","category":"SSRI Antidepressant",
     "description":"Long half-life SSRI. Potent CYP2D6 inhibitor.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Fluoxetine"},
    {"id":"lithium","name":"Lithium Carbonate","category":"Mood Stabilizer",
     "description":"Narrow therapeutic index. Sodium intake affects renal lithium clearance.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],"moleculeName":"Lithium"},
    {"id":"diazepam","name":"Diazepam (Valium)","category":"Benzodiazepine",
     "description":"CNS depressant. CYP3A4 substrate. Alcohol potentiates dangerously.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],"moleculeName":"Diazepam"},
    {"id":"lorazepam","name":"Lorazepam (Ativan)","category":"Benzodiazepine",
     "description":"Short-acting benzo. Alcohol and sedatives potentiate CNS depression.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],"moleculeName":"Lorazepam"},
    {"id":"phenytoin","name":"Phenytoin (Dilantin)","category":"Anticonvulsant",
     "description":"CYP3A4 and CYP2C9 inducer. Narrow therapeutic index.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Phenytoin"},
    {"id":"carbamazepine","name":"Carbamazepine (Tegretol)","category":"Anticonvulsant",
     "description":"Potent CYP3A4 inducer. Reduces efficacy of many co-medications.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Carbamazepine"},
    {"id":"codeine","name":"Codeine","category":"Opioid Analgesic",
     "description":"Prodrug activated by CYP2D6 to morphine. Food rarely interacts but CNS depressants are additive.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],"moleculeName":"Codeine"},
    {"id":"oxycodone","name":"Oxycodone (OxyContin)","category":"Opioid Analgesic",
     "description":"CYP3A4 substrate. Alcohol and sedatives dramatically increase CNS depression.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],"moleculeName":"Oxycodone"},
    {"id":"theophylline","name":"Theophylline (Theo-24)","category":"Bronchodilator / Asthma",
     "description":"CYP1A2 substrate. Narrow therapeutic range. Highly sensitive to diet.",
     "features":[0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Theophylline"},
    {"id":"clozapine","name":"Clozapine (Clozaril)","category":"Antipsychotic",
     "description":"CYP1A2 substrate. Smoking (CYP1A2 inducer) dramatically lowers clozapine levels.",
     "features":[0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Clozapine"},

    # METABOLIC & HORMONES
    {"id":"acetaminophen","name":"Acetaminophen (Tylenol)","category":"Analgesic / Pain Reliever",
     "description":"CYP2E1 produces hepatotoxic NAPQI. Alcohol induces this pathway severely.",
     "features":[0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Acetaminophen"},
    {"id":"ibuprofen","name":"Ibuprofen (Advil)","category":"NSAID / Anti-inflammatory",
     "description":"NSAID. Alcohol increases GI bleeding risk. Reduces antihypertensive efficacy.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Ibuprofen"},
    {"id":"metformin","name":"Metformin (Glucophage)","category":"Antidiabetic / Biguanide",
     "description":"First-line type 2 diabetes drug. Food reduces GI side effects. Alcohol increases lactic acidosis risk.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Metformin"},
    {"id":"glipizide","name":"Glipizide (Glucotrol)","category":"Sulfonylurea Antidiabetic",
     "description":"Stimulates insulin release. Alcohol potentiates hypoglycemia.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Glipizide"},
    {"id":"levothyroxine","name":"Levothyroxine (Synthroid)","category":"Thyroid Hormone",
     "description":"Thyroid hormone replacement. Absorption blocked by calcium, fiber, and soy.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Levothyroxine"},
    {"id":"contraceptive","name":"Birth Control (Oral Contraceptive)","category":"Hormone / Estradiol",
     "description":"CYP3A4 metabolized. St John's Wort and enzyme inducers cause failure.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Ethinyl Estradiol"},
    {"id":"fexofenadine","name":"Fexofenadine (Allegra)","category":"Antihistamine",
     "description":"OATP1A2 substrate. Fruit juices block this transporter.",
     "features":[0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Fexofenadine"},

    # IMMUNOLOGY & TRANSPLANT
    {"id":"cyclosporine","name":"Cyclosporine (Sandimmune)","category":"Immunosuppressant",
     "description":"CYP3A4 and P-gp substrate. Grapefruit causes toxicity. St John's Wort causes rejection.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Cyclosporine"},
    {"id":"tacrolimus","name":"Tacrolimus (Prograf)","category":"Immunosuppressant",
     "description":"CYP3A4 substrate. Similar food interactions to cyclosporine. Very narrow index.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Tacrolimus"},
    {"id":"prednisone","name":"Prednisone (Deltasone)","category":"Corticosteroid",
     "description":"High sodium diet worsens fluid retention. Grapefruit inhibits CYP3A4 metabolism.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"moleculeName":"Prednisone"},

    # BONE & MINERAL
    {"id":"alendronate","name":"Alendronate (Fosamax)","category":"Bisphosphonate",
     "description":"Must be taken fasting — any food including water severely reduces absorption.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],"moleculeName":"Alendronate"},

    # ANTIRETROVIRALS
    {"id":"ritonavir","name":"Ritonavir (Norvir)","category":"Antiretroviral / HIV",
     "description":"Potent CYP3A4 inhibitor used as a pharmacokinetic booster. High fat food increases absorption.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],"moleculeName":"Ritonavir"},
    {"id":"atazanavir","name":"Atazanavir (Reyataz)","category":"Antiretroviral / HIV",
     "description":"Absorption requires acidic stomach. Proton pump inhibitors and food dramatically reduce efficacy.",
     "features":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],"moleculeName":"Atazanavir"},
]

# ─────────────────────────────────────────────
# KNOWN INTERACTION PAIRS
# (food_id, drug_id, severity, title, mechanism, advice)
# severity: 'safe' | 'moderate' | 'severe'
# ─────────────────────────────────────────────
INTERACTIONS = [
    # GRAPEFRUIT
    ("grapefruit","atorvastatin","severe","Severe Grapefruit-Statin Toxicity","Furanocoumarins inhibit intestinal CYP3A4, causing atorvastatin levels to surge up to 200%, risking rhabdomyolysis.","Avoid all grapefruit and grapefruit juice while taking statins."),
    ("grapefruit","simvastatin","severe","Severe Simvastatin Level Spike","Same CYP3A4 inhibition mechanism as with atorvastatin. Simvastatin is even more sensitive, with levels rising up to 3-fold.","Simvastatin with grapefruit is contraindicated. Switch to rosuvastatin if needed."),
    ("grapefruit","amlodipine","moderate","Moderate Blood Pressure Drop","CYP3A4 inhibition raises amlodipine exposure causing excessive vasodilation.","Avoid large amounts of grapefruit juice with calcium channel blockers."),
    ("grapefruit","cyclosporine","severe","Severe Immunosuppressant Toxicity","CYP3A4 and P-gp inhibition massively spikes cyclosporine blood levels.","Grapefruit is absolutely contraindicated in transplant patients on cyclosporine."),
    ("grapefruit","tacrolimus","severe","Severe Tacrolimus Toxicity","Same mechanism as cyclosporine toxicity. Tacrolimus has an extremely narrow therapeutic window.","Avoid all grapefruit products during tacrolimus therapy."),
    ("grapefruit","sildenafil","moderate","Moderate PDE5 Inhibitor Level Increase","CYP3A4 inhibition raises sildenafil plasma concentration, worsening side effects including hypotension.","Limit grapefruit juice when using sildenafil."),
    ("grapefruit","diazepam","moderate","Moderate Benzodiazepine Level Increase","CYP3A4 inhibition slows diazepam metabolism, prolonging and intensifying sedation.","Avoid grapefruit juice with benzodiazepines."),
    ("grapefruit","rivaroxaban","moderate","Moderate Anticoagulant Increase","CYP3A4 inhibition raises rivaroxaban levels, increasing bleeding risk.","Avoid grapefruit with direct oral anticoagulants."),
    ("grapefruit","carbamazepine","moderate","Moderate Anticonvulsant Level Increase","CYP3A4 inhibition raises carbamazepine plasma levels, increasing toxicity risk.","Avoid grapefruit while taking carbamazepine."),
    ("grapefruit","prednisone","moderate","Moderate Corticosteroid Level Increase","CYP3A4 inhibition reduces prednisone clearance, raising immunosuppressant exposure.","Avoid grapefruit juice with corticosteroid therapy."),

    # LEAFY GREENS / VITAMIN K
    ("leafy_greens","warfarin","severe","Severe Vitamin K Anticoagulant Counteraction","Vitamin K1 in leafy greens directly restores clotting factor synthesis, opposing warfarin's mechanism.","Keep leafy green intake stable; do not suddenly increase or decrease consumption."),
    ("leafy_greens","rivaroxaban","safe","","Rivaroxaban does not depend on Vitamin K cycling, so leafy greens have minimal effect.","No specific dietary restriction needed with DOACs like rivaroxaban."),
    ("kiwi","warfarin","moderate","Moderate Anticoagulant INR Change","Kiwi contains significant Vitamin K and has mild antiplatelet properties, both affecting INR.","Eat consistent amounts of kiwi; avoid sudden large increases."),
    ("soy_foods","warfarin","moderate","Moderate Anticoagulant Instability","Soy Vitamin K and isoflavone effects can alter INR unpredictably.","Maintain consistent soy intake throughout warfarin therapy."),
    ("green_tea","warfarin","moderate","Moderate Anticoagulant Interference","Green tea Vitamin K counters warfarin, while EGCG adds mild antiplatelet action.","Consume green tea in consistent, moderate amounts."),

    # DAIRY / CALCIUM
    ("dairy","ciprofloxacin","moderate","Moderate Antibiotic Chelation","Calcium ions bind ciprofloxacin, forming unabsorbable complexes and reducing bioavailability by 50%.","Take ciprofloxacin 2 hours before or 6 hours after dairy."),
    ("dairy","tetracycline","severe","Severe Antibiotic Absorption Blockage","Calcium chelates tetracycline, reducing its absorption by up to 75%.","Never take tetracycline with dairy. Take with water on empty stomach."),
    ("dairy","doxycycline","moderate","Moderate Doxycycline Chelation","Less interaction than tetracycline but dairy still reduces absorption significantly.","Avoid dairy within 2 hours of doxycycline."),
    ("dairy","levothyroxine","moderate","Moderate Thyroid Hormone Absorption Reduction","Calcium chelates levothyroxine in the GI tract, reducing bioavailability by 20-40%.","Take levothyroxine 30-60 min before breakfast; avoid dairy for 4 hours after."),
    ("dairy","alendronate","severe","Severe Bisphosphonate Absorption Blockage","Calcium ions in dairy completely prevent alendronate absorption.","Alendronate must be taken fasting with plain water. No food for 30 minutes after."),
    ("whole_grains","alendronate","severe","Severe Bisphosphonate Absorption Blockage","Any food including grains prevents alendronate absorption.","Take alendronate on empty stomach, 30 minutes before any food."),
    ("salt_sodium","lithium","severe","Severe Lithium Toxicity via Low Sodium","Low sodium causes kidneys to retain lithium as compensation, rapidly raising toxic plasma levels.","Maintain consistent moderate sodium intake. Avoid crash low-sodium diets on lithium."),

    # TYRAMINE / MAOIs
    ("aged_cheese","nardil","severe","Hypertensive Crisis - The Cheese Effect","Phenelzine blocks MAO. Unchecked tyramine from aged cheese causes massive norepinephrine release.","Follow strict low-tyramine diet on all MAOIs. No aged cheeses, cured meats, or fermented foods."),
    ("aged_cheese","tranylcypromine","severe","Hypertensive Crisis - MAOI Interaction","Same mechanism as phenelzine. Tranylcypromine is equally dangerous with tyramine-rich foods.","Same strict low-tyramine diet required as with all MAOI antidepressants."),
    ("chocolate","nardil","severe","Severe Hypertensive Spike - MAOI+Chocolate","Tyramine and methylxanthines in chocolate trigger massive norepinephrine surge with MAOIs.","Avoid all chocolate, cocoa, and caffeine-containing foods on MAOI therapy."),
    ("grapes_raisins","nardil","severe","Severe Hypertensive Crisis - Raisins + MAOI","Raisins and dried fruits concentrate tyramine significantly. MAOIs cannot break it down.","Avoid dried fruits, raisins, and concentrated fruit products on MAOI therapy."),
    ("soy_sauce_miso","nardil","severe","Severe Fermented Food Hypertensive Crisis","Soy sauce and miso have extremely high tyramine. Fatal hypertensive events have been reported.","Avoid all fermented condiments absolutely while on MAOI therapy."),
    ("soy_sauce_miso","tranylcypromine","severe","Severe Fermented Food + MAOI Crisis","Same catastrophic tyramine/MAOI interaction applies to all irreversible MAOIs.","Strict dietary avoidance of all high-tyramine foods is mandatory."),
    ("pickled_foods","nardil","moderate","Moderate Tyramine Risk from Pickling","Fermentation produces moderate tyramine amounts. Risk depends on degree of fermentation.","Avoid pickled and fermented products while on MAOI medications."),

    # POTASSIUM & ACE INHIBITORS
    ("bananas","lisinopril","moderate","Moderate Hyperkalemia Warning","ACE inhibitors cause renal potassium retention. High potassium foods add to this, risking arrhythmias.","Monitor potassium levels. Avoid potassium supplements and very high-potassium foods."),
    ("bananas","spironolactone","severe","Severe Hyperkalemia - Potassium-Sparing Diuretic","Spironolactone retains potassium. Bananas and avocados dramatically increase hyperkalemia risk.","Severely restrict high-potassium foods on potassium-sparing diuretics."),
    ("bananas","ramipril","moderate","Moderate Hyperkalemia Warning","Same renal potassium retention mechanism as lisinopril with ACE inhibitors.","Limit bananas, avocados, and potassium supplements with all ACE inhibitors."),
    ("beetroot","lisinopril","moderate","Moderate Additive Hypotension","Dietary nitrates from beetroot potentiate ACE inhibitor vasodilation, causing blood pressure to drop too much.","Monitor blood pressure. Introduce beetroot cautiously with antihypertensives."),
    ("beetroot","sildenafil","severe","Severe Hypotension - Nitrate+PDE5 Interaction","Dietary nitrates convert to NO; sildenafil prevents NO breakdown. Combined: dangerous BP collapse.","Avoid beetroot juice and nitrate supplements entirely with PDE5 inhibitors."),
    ("black_licorice","spironolactone","severe","Severe Potassium Depletion - Licorice Opposes Diuretic","Glycyrrhizin causes potassium loss and sodium retention, directly opposing spironolactone's mechanism.","Avoid all real licorice products on potassium-sparing diuretics."),
    ("black_licorice","lisinopril","moderate","Moderate ACE Inhibitor Antagonism","Licorice sodium retention counteracts the antihypertensive effect of ACE inhibitors.","Avoid licorice candy and supplements with antihypertensive drugs."),

    # ALCOHOL
    ("alcohol","acetaminophen","severe","Severe Liver Toxicity - Alcohol + Tylenol","Alcohol induces CYP2E1 which produces hepatotoxic NAPQI from acetaminophen, exhausting liver glutathione.","Never exceed 3g acetaminophen daily with regular drinking. Avoid completely with heavy alcohol use."),
    ("alcohol","sertraline","severe","Severe CNS Depression + Serotonin Instability","Alcohol worsens SSRI-related depression, impairs judgment, and may trigger paradoxical suicidal ideation.","Avoid alcohol entirely during SSRI antidepressant therapy."),
    ("alcohol","fluoxetine","severe","Severe CNS Depression with Fluoxetine","Same CNS depression and serotonin instability risk as with sertraline.","Complete avoidance of alcohol is recommended on all SSRI medications."),
    ("alcohol","diazepam","severe","Severe CNS + Respiratory Depression","Alcohol massively potentiates benzodiazepine CNS depression, risking respiratory failure and death.","Alcohol is absolutely contraindicated with benzodiazepines."),
    ("alcohol","lorazepam","severe","Severe CNS + Respiratory Depression","Same lethal combination as alcohol with diazepam.","Never combine alcohol with any benzodiazepine medication."),
    ("alcohol","oxycodone","severe","Severe Fatal Respiratory Depression","Alcohol + opioids produce extreme CNS and respiratory depression. Leading cause of opioid overdose deaths.","Alcohol is absolutely contraindicated with any opioid medication."),
    ("alcohol","codeine","severe","Severe Opioid Respiratory Depression","Codeine converts to morphine via CYP2D6. Alcohol dramatically potentiates CNS depression.","Avoid alcohol completely with codeine and all opioid pain medications."),
    ("alcohol","metformin","moderate","Moderate Lactic Acidosis Risk","Alcohol increases lactic acid production. Combined with metformin which also affects lactate, raises lactic acidosis risk.","Limit or avoid alcohol with metformin therapy."),
    ("alcohol","ibuprofen","severe","Severe GI Bleeding - Alcohol + NSAID","Both damage GI lining via different mechanisms. Combined risk of ulcers and serious GI hemorrhage.","Never combine alcohol with NSAIDs like ibuprofen."),
    ("alcohol","glipizide","severe","Severe Hypoglycemia Risk","Alcohol inhibits liver gluconeogenesis. Sulfonylureas also lower blood sugar. Combined: severe dangerous hypoglycemia.","Avoid alcohol with all sulfonylurea antidiabetic medications."),
    ("alcohol","nardil","severe","Severe Tyramine + CNS Depression","Beer/wine contains tyramine + alcohol synergizes with MAOI to depress CNS dangerously.","Alcohol is strictly prohibited on all MAOI antidepressants."),

    # FIBER
    ("fiber_oats","digoxin","moderate","Moderate Digoxin Absorption Reduction","Soluble beta-glucan fiber traps digoxin in the gut, reducing absorption and therapeutic efficacy.","Administer digoxin 1-2 hours before high-fiber meals."),
    ("fiber_oats","levothyroxine","moderate","Moderate Thyroid Hormone Absorption Reduction","Fiber binds levothyroxine in the GI tract, reducing its systemic availability.","Take levothyroxine 30-60 min before breakfast. Avoid fiber-rich foods for 4 hours."),
    ("flaxseed","levothyroxine","moderate","Moderate Thyroid Drug Binding","Flaxseed mucilage binds levothyroxine reducing absorption if taken concurrently.","Separate levothyroxine and flaxseed consumption by at least 4 hours."),
    ("whole_grains","levothyroxine","moderate","Moderate Thyroid Hormone Phytate Binding","Phytates in whole grains bind to the levothyroxine molecule, reducing its bioavailability.","Take levothyroxine well before any grain-based meals."),
    ("legumes","levothyroxine","moderate","Moderate Thyroid Drug Absorption Interference","High fiber and phytate content in legumes reduces levothyroxine absorption.","Consistent separation of levothyroxine dosing from high-fiber meals is key."),

    # FRUIT JUICES / OATP
    ("apple_juice","fexofenadine","moderate","Moderate Allergy Drug Absorption Blockage","Naringin blocks OATP1A2 transporters needed to absorb fexofenadine, reducing bioavailability by 70%.","Take fexofenadine with water. Avoid juices for 4 hours around dosing."),
    ("green_tea","fexofenadine","moderate","Moderate OATP Transporter Inhibition by EGCG","EGCG in green tea inhibits OATP1A2, reducing fexofenadine absorption similarly to fruit juices.","Take fexofenadine with water, not green tea or matcha."),
    ("pomegranate","warfarin","severe","Severe Anticoagulant Potentiation","Pomegranate inhibits CYP3A4 and CYP2C9, the primary warfarin-metabolizing enzymes, raising INR dangerously.","Avoid pomegranate juice entirely on warfarin therapy. Monitor INR closely."),
    ("pomegranate","atorvastatin","moderate","Moderate Statin Level Increase","Similar CYP3A4 inhibition to grapefruit raises atorvastatin levels and myopathy risk.","Limit pomegranate juice with statin therapy."),
    ("cranberry_juice","warfarin","severe","Severe Anticoagulant Toxicity Risk","CYP2C9 inhibition by cranberry flavonoids raises warfarin plasma levels and INR dramatically.","Avoid cranberry juice and cranberry supplements on warfarin."),
    ("cranberry_juice","clopidogrel","moderate","Moderate Antiplatelet Efficacy Reduction","CYP2C19 inhibition reduces clopidogrel activation, potentially increasing thrombotic risk.","Avoid excessive cranberry juice with clopidogrel therapy."),

    # ST JOHN'S WORT
    ("st_johns_wort","contraceptive","severe","Severe Contraceptive Failure Risk","CYP3A4 and P-gp induction by hyperforin dramatically lowers estrogen levels causing breakthrough bleeding and failure.","Avoid St John's Wort completely with oral contraceptives. Use barrier method as backup."),
    ("st_johns_wort","sertraline","severe","Severe Serotonin Syndrome Warning","Combined serotonin activity from St John's Wort + SSRI can trigger hyperthermia, tremors, and agitation.","Never combine St John's Wort with SSRI antidepressants."),
    ("st_johns_wort","cyclosporine","severe","Severe Organ Rejection Risk","CYP3A4 induction drops cyclosporine levels below therapeutic range, causing acute transplant rejection.","St John's Wort is absolutely contraindicated in transplant patients."),
    ("st_johns_wort","tacrolimus","severe","Severe Tacrolimus Level Drop","Same induction mechanism as cyclosporine. Even a small drop in tacrolimus causes rejection.","Never use St John's Wort with tacrolimus."),
    ("st_johns_wort","rivaroxaban","moderate","Moderate DOAC Level Reduction","P-gp and CYP3A4 induction reduces rivaroxaban exposure, decreasing anticoagulant protection.","Avoid St John's Wort with all anticoagulants."),
    ("st_johns_wort","atorvastatin","moderate","Moderate Statin Level Reduction","CYP3A4 induction speeds up statin metabolism, reducing therapeutic cholesterol-lowering effect.","Avoid St John's Wort while on statin therapy."),
    ("st_johns_wort","phenytoin","moderate","Moderate Anticonvulsant Level Reduction","CYP induction reduces phenytoin levels, risking seizure breakthrough.","Avoid St John's Wort with anticonvulsant medications."),
    ("st_johns_wort","carbamazepine","moderate","Moderate Anticonvulsant Interaction","CYP3A4 induction reduces carbamazepine metabolite levels unpredictably.","Avoid St John's Wort during anticonvulsant therapy."),

    # BROCCOLI / CYP1A2
    ("broccoli","theophylline","moderate","Moderate Asthma Drug Clearance Acceleration","Cruciferous indoles induce CYP1A2, accelerating theophylline clearance and lowering therapeutic levels.","Maintain stable cruciferous vegetable intake. Notify doctor of major diet changes."),
    ("broccoli","clozapine","moderate","Moderate Antipsychotic Level Reduction","CYP1A2 induction by cruciferous vegetables speeds clozapine clearance, potentially reducing psychiatric control.","Consistent vegetable intake is important. Monitor for signs of reduced clozapine effect."),
    ("coffee","theophylline","severe","Severe Methylxanthine Toxicity","Caffeine competes with theophylline via the same CYP1A2 pathway, causing theophylline accumulation and toxicity.","Minimize caffeine while on theophylline therapy."),
    ("coffee","clozapine","moderate","Moderate CYP1A2 Competition","High caffeine intake inhibits CYP1A2, raising clozapine plasma levels potentially into toxic range.","Limit caffeine intake with clozapine. Monitor plasma clozapine levels."),
    ("high_protein","theophylline","moderate","Moderate Asthma Drug Clearance Increase","High-protein diet upregulates CYP1A2, speeding theophylline metabolism and reducing its efficacy.","Maintain consistent dietary protein intake on theophylline therapy."),

    # GARLIC / ANTIPLATELET
    ("garlic_ginkgo","aspirin","moderate","Moderate Antiplatelet Synergy - Garlic + Aspirin","Both garlic compounds and aspirin inhibit platelet aggregation additively, increasing bleeding risk.","Use caution with high-dose garlic supplements alongside antiplatelet aspirin."),
    ("garlic_ginkgo","warfarin","severe","Severe Bleeding Risk - Garlic + Warfarin","Garlic and ginkgo antiplatelet effects synergize with warfarin's anticoagulation causing serious hemorrhagic risk.","Avoid high-dose garlic/ginkgo supplements on warfarin. Report all supplements to prescriber."),
    ("garlic_ginkgo","clopidogrel","moderate","Moderate Antiplatelet Potentiation","Additive platelet inhibition from garlic compounds and clopidogrel increases bleeding risk.","Avoid garlic supplements with antiplatelet drug therapy."),
    ("flaxseed","warfarin","moderate","Moderate Anticoagulant Potentiation","Flaxseed omega-3 and lignans have mild antiplatelet properties that add to warfarin's effect.","Limit high-dose flaxseed oil supplements on warfarin."),
    ("fatty_fish","warfarin","moderate","Moderate Anticoagulant Potentiation via Omega-3","High-dose fish oil omega-3 EPA/DHA have antiplatelet actions that add to warfarin's anticoagulation.","Inform your anticoagulation clinic if taking high-dose fish oil supplements."),
    ("walnuts","warfarin","moderate","Moderate Antiplatelet Potentiation","Omega-3 and quercetin in walnuts have mild antiplatelet effects that may affect INR.","High-dose walnut oil supplements should be disclosed to your anticoagulation provider."),

    # GINSENG & HYPOGLYCEMICS
    ("ginseng","metformin","moderate","Moderate Hypoglycemia Alert","Ginsenosides enhance insulin sensitivity additively with metformin, potentially causing dangerous hypoglycemia.","Monitor blood glucose closely. Be aware of hypoglycemia signs."),
    ("ginseng","glipizide","severe","Severe Hypoglycemia - Ginseng + Sulfonylurea","Ginseng hypoglycemic action combined with sulfonylurea insulin-releasing effect causes serious blood sugar drops.","Avoid ginseng supplements while taking sulfonylurea antidiabetics."),
    ("bitter_melon","metformin","severe","Severe Hypoglycemia - Bitter Melon + Metformin","Charantin in bitter melon has potent hypoglycemic action that synergizes dangerously with metformin.","Avoid bitter melon with antidiabetic medications. Monitor glucose very closely."),
    ("bitter_melon","glipizide","severe","Severe Hypoglycemia Risk","Additive hypoglycemia from both charantin (bitter melon) and glipizide insulin stimulation.","Avoid bitter melon with all antidiabetic medications."),
    ("fenugreek","metformin","moderate","Moderate Additive Hypoglycemia","Fenugreek slows carbohydrate absorption and has mild hypoglycemic effects that can add to metformin.","Monitor blood sugar. Adjust fenugreek consumption consistently."),
    ("cinnamon","metformin","moderate","Moderate Additive Blood Sugar Lowering","Cinnamon's hypoglycemic action can add to metformin's effect, risking blood sugar drops.","Monitor glucose when using high-dose cinnamon supplements with antidiabetic drugs."),

    # SOY FOODS
    ("soy_foods","levothyroxine","severe","Severe Thyroid Hormone Absorption Blockage","Isoflavones bind levothyroxine in the GI tract, severely reducing therapeutic availability.","Take levothyroxine on empty stomach; avoid soy foods for at least 4 hours afterward."),
    ("soy_foods","warfarin","moderate","Moderate INR Instability","Soy Vitamin K and estrogen-like effects alter clotting factor synthesis, changing INR unpredictably.","Maintain consistent soy intake week to week during warfarin therapy."),

    # TURMERIC
    ("turmeric","warfarin","severe","Severe Bleeding Risk - Turmeric + Warfarin","Curcumin inhibits CYP2C9, raising warfarin levels, and directly inhibits platelet aggregation.","Avoid high-dose curcumin supplements on warfarin therapy."),
    ("turmeric","aspirin","moderate","Moderate Antiplatelet Synergy","Curcumin's antiplatelet action adds to aspirin's, increasing bleeding risk.","Use caution with turmeric supplements alongside antiplatelet therapy."),
    ("turmeric","atorvastatin","moderate","Moderate Statin Level Increase","Curcumin CYP3A4 inhibition raises statin blood levels, increasing myopathy risk.","Standard dietary turmeric is safe; avoid high-dose curcumin supplements with statins."),

    # HIGH FAT MEAL
    ("high_fat_meal","ritonavir","safe","Beneficial: High Fat Improves Ritonavir Absorption","Ritonavir has much better bioavailability when taken with a high-fat meal.","Take ritonavir with a meal for optimal absorption."),
    ("high_fat_meal","atazanavir","safe","Beneficial: Food Improves Atazanavir Absorption","Atazanavir requires an acidic environment and food to be absorbed effectively.","Always take atazanavir with food."),
    ("high_fat_meal","fluconazole","safe","Minimal Effect: Food Does Not Significantly Affect Fluconazole","Fluconazole absorption is not significantly altered by food intake.","Fluconazole can be taken with or without food."),

    # KAVA & VALERIAN (CNS)
    ("kava","diazepam","severe","Severe CNS Depression - Kava + Benzodiazepine","Kavalactones potentiate GABA receptor activity, synergizing with benzodiazepine CNS depression.","Kava is contraindicated with any benzodiazepine medication."),
    ("kava","lorazepam","severe","Severe Respiratory Depression Risk","Same GABA potentiation mechanism. Risk of respiratory failure with lorazepam combination.","Never combine kava with benzodiazepines."),
    ("valerian","diazepam","moderate","Moderate Sedative Potentiation","Valerian's GABA-modulating effect adds to diazepam's sedation, causing excessive drowsiness.","Avoid valerian root supplements with benzodiazepine medications."),
    ("valerian","oxycodone","moderate","Moderate CNS Depression Enhancement","Valerian sedative effects add to opioid CNS depression, increasing sedation and respiratory risk.","Avoid valerian with opioid pain medications."),

    # ECHINACEA
    ("echinacea","cyclosporine","moderate","Moderate Immunosuppressant Level Change","Echinacea CYP3A4 modulation may alter cyclosporine levels unpredictably.","Avoid echinacea in transplant patients on cyclosporine or tacrolimus."),
    ("echinacea","tacrolimus","moderate","Moderate Immunosuppressant Interaction","Same CYP3A4 modulation issue as with cyclosporine. Tacrolimus has very narrow therapeutic range.","Consult transplant team before using any herbal supplement."),

    # ONION/QUERCETIN
    ("onion_quercetin","warfarin","moderate","Moderate INR Increase via Quercetin","High-dose quercetin inhibits CYP2C9 and has mild anticoagulant effects, raising warfarin exposure.","High-dose quercetin supplements should be avoided on warfarin."),
    ("onion_quercetin","cyclosporine","moderate","Moderate Immunosuppressant Level Increase","Quercetin inhibits P-glycoprotein and CYP3A4, raising cyclosporine plasma levels.","Avoid quercetin supplements with cyclosporine or tacrolimus."),

    # MISC IMPORTANT ONES
    ("parsley_celery","warfarin","moderate","Moderate Coumarin Anticoagulant Synergy","Parsley and celery contain natural coumarins that may add to warfarin's anticoagulant effect.","Consume parsley and celery in consistent, moderate amounts during warfarin therapy."),
    ("coffee","sertraline","moderate","Moderate Anxiety Exacerbation","Caffeine worsens SSRI-induced anxiety side effects and may mildly inhibit CYP1A2.","Limit caffeine during initial SSRI therapy."),
    ("black_tea","tetracycline","moderate","Moderate Antibiotic Tannin Chelation","Tannins in black tea bind to tetracycline, reducing its absorption from the GI tract.","Take tetracycline antibiotics with plain water, not tea."),
    ("black_tea","doxycycline","moderate","Moderate Antibiotic Absorption Reduction","Same tannin-chelation mechanism as with tetracycline.","Avoid tea and coffee around doxycycline dosing."),
    ("energy_drinks","theophylline","severe","Severe Methylxanthine Toxicity - Energy Drink + Theophylline","Extremely high caffeine in energy drinks severely competes with theophylline CYP1A2 clearance.","Avoid energy drinks completely while on theophylline."),
    ("energy_drinks","lithium","moderate","Moderate Diuretic Dehydration Risk","High caffeine is diuretic; dehydration concentrates lithium to toxic plasma levels.","Avoid high-caffeine drinks on lithium; maintain good hydration."),
    ("tomatoes","warfarin","safe","Safe: Tomatoes Have Negligible Warfarin Effect","Lycopene and mild Vitamin K levels in tomatoes do not significantly affect INR.","Tomatoes are generally safe with warfarin in normal dietary amounts."),
    ("chili_pepper","warfarin","moderate","Moderate Anticoagulant Potentiation","Capsaicin has mild antiplatelet and anticoagulant properties, potentially adding to warfarin.","Avoid extremely high capsaicin supplement doses on warfarin."),
    ("bitter_melon","warfarin","moderate","Moderate Anticoagulant Potentiation","Bitter melon may inhibit platelet aggregation and modestly affect CYP enzymes.","Avoid bitter melon supplements during warfarin therapy."),
]

# ─────────────────────────────────────────────
# GENERATE JS OUTPUT
# ─────────────────────────────────────────────

def feat_arr(features, expected_len):
    """Pad or trim features array to expected length."""
    arr = list(features) + [0] * expected_len
    return arr[:expected_len]

def js_array(arr):
    return "[" + ", ".join(str(int(x)) for x in arr) + "]"

def gen_foods_js():
    lines = ["export const FOODS = ["]
    for f in FOODS_DB:
        fa = feat_arr(f.get("features", []), NFOOD)
        mol = f.get("moleculeName", "Unknown")
        lines.append(f"""  {{
    id: "{f['id']}",
    name: "{f['name']}",
    category: "{f['category']}",
    description: "{f['description'].replace('"', "'")}",
    features: {js_array(fa)},
    image: "{f['id']}",
    moleculeName: "{mol}",
    commonMolecules: ["C", "H", "O"]
  }},""")
    lines.append("];")
    return "\n".join(lines)

def gen_drugs_js():
    lines = ["export const DRUGS = ["]
    for d in DRUGS_DB:
        da = feat_arr(d.get("features", []), NDRUG)
        mol = d.get("moleculeName", "Unknown")
        lines.append(f"""  {{
    id: "{d['id']}",
    name: "{d['name']}",
    category: "{d['category']}",
    description: "{d['description'].replace('"', "'")}",
    features: {js_array(da)},
    moleculeName: "{mol}",
    commonMolecules: ["C", "H", "O"]
  }},""")
    lines.append("];")
    return "\n".join(lines)

def gen_paired_js():
    lines = ["export const PAIRED_INTERACTIONS = {"]
    for item in INTERACTIONS:
        food_id, drug_id, severity, title, mechanism, advice = item
        if severity == "safe":
            continue  # Only label non-safe interactions (safe is default)
        key = f"{food_id}+{drug_id}"
        lines.append(f"""  "{key}": {{
    severity: "{severity}",
    title: "{title.replace('"', "'")}",
    mechanism: "{mechanism.replace('"', "'")}",
    advice: "{advice.replace('"', "'")}"
  }},""")
    lines.append("};")
    return "\n".join(lines)

def gen_features_js():
    food_feat = "export const FOOD_FEATURES = [\n" + \
        ",\n".join(f'  "{f}"' for f in FOOD_FEATURES) + "\n];"
    drug_feat = "export const DRUG_FEATURES = [\n" + \
        ",\n".join(f'  "{f}"' for f in DRUG_FEATURES) + "\n];"
    return food_feat + "\n\n" + drug_feat

def main():
    print(f"📊 Dataset Summary:")
    print(f"   Foods:    {len(FOODS_DB)}")
    print(f"   Drugs:    {len(DRUGS_DB)}")
    print(f"   Pairs:    {len(FOODS_DB) * len(DRUGS_DB)} total combinations")
    print(f"   Labeled:  {len([i for i in INTERACTIONS if i[2] != 'safe'])} known interactions")
    print(f"   Safe:     {len(FOODS_DB) * len(DRUGS_DB) - len(INTERACTIONS)} (default safe baseline)")
    print()

    output = """// AUTO-GENERATED by generate_dataset.py
// DO NOT EDIT MANUALLY — run `python3 scripts/generate_dataset.py` to regenerate
// Dataset: {foods} foods x {drugs} drugs = {pairs} training combinations

""".format(
        foods=len(FOODS_DB),
        drugs=len(DRUGS_DB),
        pairs=len(FOODS_DB)*len(DRUGS_DB)
    )

    output += gen_features_js() + "\n\n"
    output += gen_foods_js() + "\n\n"
    output += gen_drugs_js() + "\n\n"
    output += gen_paired_js() + "\n\n"

    # Minimal MOLECULES stub (the rest stays in the existing file)
    output += """// 3D Molecule structures are defined in src/data/molecules.js
export const MOLECULES = {};
"""

    out_path = "src/data/interactions_generated.js"
    with open(out_path, "w") as f:
        f.write(output)

    print(f"✅ Written to {out_path}")
    print(f"   Replace src/data/interactions.js with this file to use the expanded dataset.")
    print(f"   Note: merge the MOLECULES export from the original interactions.js manually.")

if __name__ == "__main__":
    main()
