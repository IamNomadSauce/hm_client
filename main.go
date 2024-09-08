package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"github.com/joho/godotenv"
)

func main() {
	
	fmt.Println("main")
	err := godotenv.Load()

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
