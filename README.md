<div align="center">
<img src="./assets/logo.png" width="300">

This project showcase how to use the LaCarteDesColocs Email Push Notification with Google API to automate the flat share process.

</div>

### Pre-requisites
- A Google Cloud Platform account with the Gmail API and Maps enabled.
- An API key for the Google Maps and Calendar API.
- A `credentials.json` file for the Gmail API.
- Mail Notifications from *LaCarteDesColocs* enabled. 

>[!IMPORTANT]
> You need to have a `.env` file with the following variables:
> - `GOOGLE_API_KEY` : Your Google Maps API key.

### Installation

```bash
git clone git@github.com:GridexX/search-coloc.git
cd search-coloc
npm install
```

### Usage

This repository contains a few scripts to automate the flat share process.

#### Retrieve the last announces from LaCarteDesColocs

Each morning, you received a mail from LaCarteDesColocs with the last announces.

Ths script will retrieve the last announces from the mail and save them into a JSON file.  
Announce are sorted by `travel_time` from your **work** and the **city center** to the announce location.

#### 🫲 Filtering the announces

You can modify the filterApartment function to filter the announces based on your preferences.

```javascript
function filterApartments(apartments) {

  const maxRooms = 5; // 4 roommates and the living room
  const minSurface = 10; // 10 m2 for the room

  const maxTravelComedie = 12; // 12 minutes by bike to Comedie
  const maxTravelPolytech = 20; // 20 minutes by bike to Polytech

  return apartments.filter(apartment => {
    return apartment.rooms <= maxRooms &&
      apartment.roomSurface >= minSurface &&
      apartment.travelTimeBikeToComedie <= maxTravelComedie &&
      apartment.travelTimeBikeToPolytech <= maxTravelPolytech;
  })

}
```

Filtered Apartments are then saved in a `global.csv` file.


#### 🔍 Analyze the announces

This section analyze the announce based on some criteria. It uses the power of ChatGPT to generate a summary of the announce and Notion to save the announce.



> [!IMPORTANT]
> For this step, you need to have a **Notion Database** template downloaded. 
> You need to authorize the integration of your DB in Notion, see [here](https://developers.notion.com/docs/create-a-notion-integration#create-your-integration-in-notion).  
> 
> You also must have a `NOTION_TOKEN` and `NOTION_DATABASE_ID` in your `.env` file.

You can find the Notion Database template [here](https://www.notion.so/1f790022605641729fe73c7af247390e?v=83e051b84448472f985cc8b818bc35dc)

Once you met the pre-requisites, you can run the script to analyze the announces.

1. Copy the **announce** and insert it into the prompt.

  ```bash
    export ANNOUNCE=$(pbpaste)
    envsubst < prompt.txt > prompt2
  ```

2. Copy the prompt into ChatGPT and generate a summary of the announce.
3. Copy the generated command into the terminal !
4. The script will generate a summary of the announce and save it into your Notion Database 🤩
5. Remove the `prompt2` file.
> [!TIP]
> Update the `prompt.txt` to match your preferences. Also, you can modify the **Notion Template** to save more information about the announce.


##### Demo

![Demo](./assets/analyse_coloc.gif)