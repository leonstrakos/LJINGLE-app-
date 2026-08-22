E OVDJE CES NACI STVARI LIKE SQL I TO STA SM MISLIO

ZNACI TV TIME JE SHUT DWON IMAM BACKUPFILES OD TOGA :: ALI ZNACI HTIO BI BOOKS GAMES TVTIME I OSTALO IMA T U JEDNOJ APP KUZISSS  



hey can you make me this (node js ) html css and  mysql  

Tracker app that tracks different media content + life activities of user as a time management and database app

Would be great with some api, and intergrating with other apps and platforms but..
Anyways here are the features

FEATURES
Entertainment section (books, games, tv, movies) different information for different sections( aka inserting completion percentage for games) 

Wish list (aka backlog, plan to etc)

Time trackers (stopwatches, that you can click fastly to continue the action (eg. everytime user starts reading a book, since time reading varies from person to person, same with video game)

Daily time breakdown (with things it knows like lenght of movie + time trackers ..woudl be best seamless but requires a lot of integration and app popularity)

Text editor (for keeping notes, that can also be organised under topics, with quotes and widgets for the dashboard)

Add topic (topics are eg chess -time spent playing vs learning - both are under topic chess but tracked differently)

RATING system
Enjoyed , okay, regret/waste of time (instead of scores)
Favorited (ability to favorite/heart)


example of sql 
games table
title
platform
date of completion
playtime
note
category of completion (type) finished | quit | played | list


here im sending a design pdf first is home page with colors others are wifeframes 
ill also want to add stopwatches adn stuff on the dashboard rght 





structure tracker-app/
│── server.js
│── db.js
│── routes/
│   ├── time.js
│   ├── media.js
│   ├── topics.js
│── public/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── stopwatch.js




CLOCK


okay lets start from the beggining one by one, first lets make a functional stopwatch and clocks .. 
 heres the clock feature as i imagined it ... 
 i open the app theres a clock/stopwatch .. (if styling immediately style it like analog stopwatch)
 i click on it - time starts
 click again - times pauses
 WHEN PAUSED - above theres an input for you to insert a label to name the activity youre tracking time for
 so time is always updated and saved...
 
 next someone of the side is fuction to add another timer, so you can start multiple simutaniously ofc

and when you load the app all labels are displayed as list that when clicked on, their timer shows up to continue 

