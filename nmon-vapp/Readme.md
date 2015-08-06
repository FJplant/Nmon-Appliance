nmon-vapp
==========

Nmon.io Virtual Appliance Component

Introduction
------------
nmon-vapp is a virtual appliance on which Nmon.io product runs

	uses CentOS as an Operating System, Oracle XE or PostgreSQL for metadata, MongoDB, PostgreSQL or Oracle as nmon log data repository

	Physical Appliance is configured with mirrored SSD and ZFS volume

	on VMware Hypervisor using FreeNAS storage

Requirements
------------

	1. Customer should not log in nmondb appliance to protect our source code from theft.
    
	2. Buy, delivery, plugging and configuration model.
    
	3. Redunduncies requirements
    
	- Network redunduncy
    
	- Storage redunduncy 
	  Tier 1 - mirrored SSD storage, 
	  Tier 2 - mirrored SATA storage for backup data

	- Supports fail-over to stand-by server
