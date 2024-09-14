package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
  "html/template"
	"os"
	"github.com/joho/godotenv"
)

func main() {
	
	fmt.Println("main")

  http.HandleFunc("/", homeHandler)
  http.HandleFunc("/finance", financeHandler)

  err := http.ListenAndServe(":8080", nil)

  // -----------------------------------------------
  
	err = godotenv.Load()

	url := os.Getenv("URL")

	resp, err := http.Get(url)
	if err != nil {
		fmt.Println("Error retrieval of url", err)
	}

	defer resp.Body.Close()

	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatalf("Error reading response body: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		log.Fatalf("Unexpected status code: %d", resp.StatusCode, string(body))
	}

	fmt.Println("Received Data:", string(body))
}

func homeHandler(w http.ResponseWriter, r *http.Request) {
  fmt.Println("Home Request")
  tmpl, err := template.ParseFiles("templates/home.html")
  if err != nil {
    http.Error(w, "Error parsing template", http.StatusInternalServerError)
  }

  err = tmpl.Execute(w, nil)
  if err != nil {
    http.Error(w, "Error executing temlate", http.StatusInternalServerError)
  }

}

func financeHandler(w http.ResponseWriter, r *http.Request) {
  fmt.Println("Finance Page Request")
  tmpl, err := template.ParseFiles("templates/finance.html")
  if err != nil {
    http.Error(w, "Error parsing template", http.StatusInternalServerError)
  }

  err = tmpl.Execute(w, nil)
  if err != nil {
    http.Error(w, "Error executing temlate", http.StatusInternalServerError)
  }
}

