# Timecard
Timecard generates a Gantt chart to visualize the Google Docs/Slides/Sheet revision history of multiple users over time. 

Timecard uses the unofficial revisions:tiles API to get access to detailed revision history data.

To use without "https://www.googleapis.com/auth/drive.metadata.readonly" scope, open Google Doc, open Chrome Developer Tools, open Network Panel, click on see revision history, look for xhr request that matches the one below, modify to remove start and end parameters. Upload the json.txt file to timecard to generate a Gantt chart of time spent in the Google Doc.

Note the code quality here is lower than my other projects, as this entire project was completed in 7 hours.

## Example
![Screenshot](https://raw.githubusercontent.com/steventango/timecard/master/screenshot.png)
